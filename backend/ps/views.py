from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import DepartmentInfo
from ps.models import Indent, IndentAudit
from ps.rbac import ActingRole, get_actor_context, require_extrainfo, user_has_designation, user_is_hod
from ps.serializers import HODActionSerializer, IndentCreateSerializer, IndentSerializer
from ps.services import (
    check_stock,
    get_accounts_admin,
    get_department_depadmin,
    get_department_hod,
    get_registrar_or_director,
    get_first_holder_by_designation,
)


class IndentViewSet(viewsets.ModelViewSet):
    queryset = Indent.objects.select_related("indenter", "department", "current_approver").prefetch_related("items")

    def get_serializer_class(self):
        if self.action == "create":
            return IndentCreateSerializer
        return IndentSerializer

    def _actor(self):
        try:
            return get_actor_context(self.request)
        except PermissionError as e:
            raise PermissionDenied(str(e)) from e

    def get_queryset(self):
        actor = self._actor()
        qs = super().get_queryset()
        if actor.role == ActingRole.EMPLOYEE:
            return qs.filter(indenter=actor.extrainfo)
        if actor.role in (ActingRole.DEPADMIN, ActingRole.HOD):
            return qs.filter(current_approver=actor.extrainfo)
        if actor.role in (ActingRole.REGISTRAR, ActingRole.DIRECTOR):
            return qs.filter(current_approver=actor.extrainfo)
        raise PermissionDenied("Unauthorized")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        indent = serializer.save()
        return Response(IndentSerializer(indent).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="decisions")
    def decisions(self, request):
        """
        Indents approved/rejected by the current user in the currently acting role.
        """
        actor = self._actor()
        if actor.role in (ActingRole.EMPLOYEE,):
            raise PermissionDenied("Only approver roles can view decisions.")

        indent_ids = (
            IndentAudit.objects.filter(
                user=request.user,
                acting_role=actor.role,
                action__in=["APPROVE", "REJECT"],
            )
            .order_by("-created_at")
            .values_list("indent_id", flat=True)
            .distinct()
        )

        qs = (
            Indent.objects.select_related("indenter", "department", "current_approver")
            .prefetch_related("items")
            .filter(id__in=indent_ids)
            .order_by("-updated_at")
        )
        return Response(IndentSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="hod-action")
    def hod_action(self, request, pk=None):
        actor = self._actor()
        if actor.role not in (
            ActingRole.DEPADMIN,
            ActingRole.HOD,
            ActingRole.REGISTRAR,
            ActingRole.DIRECTOR,
        ):
            raise PermissionDenied("Not allowed to perform approval actions.")

        indent = self.get_object()
        if indent.current_approver_id and indent.current_approver_id != actor.extrainfo.id:
            raise PermissionDenied("You are not the current approver for this indent.")

        data_ser = HODActionSerializer(data=request.data)
        data_ser.is_valid(raise_exception=True)
        action_name = data_ser.validated_data["action"]
        notes = data_ser.validated_data.get("notes", "")

        if action_name == "APPROVE":
            if actor.role == ActingRole.DEPADMIN:
                if indent.status != Indent.Status.STOCK_CHECKED:
                    raise ValidationError({"detail": "Please check stock before approving."})
                if indent.stock_available:
                    indent.status = Indent.Status.INTERNAL_ISSUED
                else:
                    indent.status = Indent.Status.EXTERNAL_PROCUREMENT
                indent.current_approver = None
                indent.save(update_fields=["status", "current_approver", "updated_at"])
            elif actor.role == ActingRole.HOD:
                next_approver = get_department_depadmin(indent.department)
                if not next_approver:
                    raise ValidationError({"detail": "No DepAdmin found for this department."})
                indent.current_approver = next_approver
                indent.status = Indent.Status.FORWARDED
                indent.save(update_fields=["status", "current_approver", "updated_at"])
            elif actor.role in (ActingRole.REGISTRAR, ActingRole.DIRECTOR):
                indent.status = Indent.Status.APPROVED
                indent.current_approver = None
                indent.save(update_fields=["status", "current_approver", "updated_at"])
            else:
                raise ValidationError({"action": "Invalid approver role"})
        elif action_name == "REJECT":
            indent.status = Indent.Status.REJECTED
            indent.current_approver = None
            indent.save(update_fields=["status", "current_approver", "updated_at"])
        elif action_name == "FORWARD":
            # Backward-compatible:
            # - if client provides forward_to_department_code, do the old behavior (department forward)
            # - otherwise forward-to-director is DEPADMIN-only
            dept_code = (data_ser.validated_data.get("forward_to_department_code") or "").strip()
            if dept_code:
                target_dept = DepartmentInfo.objects.filter(code__iexact=dept_code).first()
                if not target_dept:
                    raise ValidationError({"forward_to_department_code": "Unknown department code."})
                target_hod = get_department_hod(target_dept)
                indent.department = target_dept
                indent.current_approver = target_hod
                indent.status = Indent.Status.FORWARDED if target_hod else Indent.Status.SUBMITTED
                indent.save(update_fields=["department", "current_approver", "status", "updated_at"])
            else:
                if actor.role != ActingRole.DEPADMIN:
                    raise PermissionDenied("Only DepAdmin can forward to Director.")
                next_approver = get_first_holder_by_designation("director")
                if not next_approver:
                    raise ValidationError({"detail": "No Director found to forward to."})
                indent.current_approver = next_approver
                indent.status = Indent.Status.FORWARDED_TO_DIRECTOR
                indent.save(update_fields=["current_approver", "status", "updated_at"])
        else:
            raise ValidationError({"action": "Invalid action"})

        IndentAudit.objects.create(
            indent=indent,
            user=request.user,
            acting_role=actor.role,
            action=action_name,
            notes=notes,
        )

        return Response(IndentSerializer(indent).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="stock-breakdown")
    def stock_breakdown(self, request, pk=None):
        actor = self._actor()
        if actor.role not in (ActingRole.DEPADMIN, ActingRole.HOD):
            raise PermissionDenied("Only DepAdmin/HOD can view stock breakdown.")

        indent = self.get_object()
        if indent.department_id != actor.extrainfo.department_id:
            raise PermissionDenied("Cannot view other department's indent.")

        breakdown = []
        for line in indent.items.select_related("item").all():
            stock = line.item.stock.quantity if hasattr(line.item, "stock") and line.item.stock else 0
            ok = stock >= line.quantity
            breakdown.append(
                {
                    "item_id": line.item_id,
                    "item_name": line.item.name,
                    "requested_qty": line.quantity,
                    "available_qty": stock,
                    "ok": ok,
                }
            )

        return Response({"indent_id": indent.id, "all_available": all(b["ok"] for b in breakdown), "items": breakdown})

    @action(detail=True, methods=["post"], url_path="check-stock")
    def check_stock_action(self, request, pk=None):
        actor = self._actor()
        if actor.role != ActingRole.DEPADMIN:
            raise PermissionDenied("Only DepAdmin can check stock.")
        indent = self.get_object()
        if indent.department_id != actor.extrainfo.department_id:
            raise PermissionDenied("Cannot check other department's indent.")
        indent.stock_available = check_stock(indent)
        indent.procurement_type = (
            Indent.ProcurementType.INTERNAL if indent.stock_available else Indent.ProcurementType.EXTERNAL
        )
        indent.status = Indent.Status.STOCK_CHECKED
        indent.save(update_fields=["stock_available", "procurement_type", "status", "updated_at"])
        IndentAudit.objects.create(
            indent=indent,
            user=request.user,
            acting_role=actor.role,
            action="CHECK_STOCK",
            notes="",
        )
        return Response(IndentSerializer(indent).data)


class MeViewSet(viewsets.ViewSet):
    """
    Returns identity + allowed acting roles for the authenticated user.
    This endpoint does NOT require X-Acting-Role.
    """

    def list(self, request):
        extrainfo = require_extrainfo(request.user)
        allowed = [ActingRole.EMPLOYEE]
        if user_has_designation(extrainfo, "depadmin"):
            allowed.append(ActingRole.DEPADMIN)
        if user_is_hod(extrainfo):
            allowed.append(ActingRole.HOD)
        if user_has_designation(extrainfo, "registrar"):
            allowed.append(ActingRole.REGISTRAR)
        if user_has_designation(extrainfo, "director"):
            allowed.append(ActingRole.DIRECTOR)

        return Response(
            {
                "user": {"id": request.user.id, "username": request.user.username},
                "department": {"id": extrainfo.department_id, "code": extrainfo.department.code},
                "allowed_roles": allowed,
            }
        )

