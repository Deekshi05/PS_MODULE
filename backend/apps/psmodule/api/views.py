from django.db import transaction
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.psmodule.models import Stock, TransferLog, TransferRequest
from apps.psmodule.selectors import (
    ActingRole,
    get_actor_context,
    get_indent_decisions_for_actor_data,
    get_indents_for_actor_data,
    get_me_payload,
    get_user_depadmin_role,
    get_user_ps_admin_role,
    get_procurement_ready_indents_for_actor_data,
    get_ps_admin_indents_by_category,
    require_depadmin_role,
    get_stock_breakdown_data,
    get_store_item_stock_check_status,
)
from apps.psmodule.services import (
    apply_hod_action,
    apply_ps_admin_action,
    check_stock_action,
    confirm_delivery,
    create_indent,
    create_stock_entry,
)
from apps.psmodule.api.serializers import (
    HODActionSerializer,
    IndentCreateSerializer,
    PSAdminActionSerializer,
    StockSerializer,
    StockEntryCreateSerializer,
    TransferRequestCreateSerializer,
    TransferRequestSerializer,
)


class IndentViewSet(viewsets.ViewSet):
    def _actor(self):
        try:
            return get_actor_context(self.request)
        except PermissionError as e:
            raise PermissionDenied(str(e)) from e

    def list(self, request):
        actor = self._actor()
        return Response(get_indents_for_actor_data(actor))

    def create(self, request):
        actor = self._actor()
        serializer = IndentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = create_indent(serializer.validated_data, actor, request.user)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="decisions")
    def decisions(self, request):
        actor = self._actor()
        if actor.role == ActingRole.EMPLOYEE:
            raise PermissionDenied("Only approver roles can view decisions.")
        return Response(get_indent_decisions_for_actor_data(actor, request.user))

    @action(detail=False, methods=["get"], url_path="procurement-ready")
    def procurement_ready(self, request):
        actor = self._actor()
        return Response(get_procurement_ready_indents_for_actor_data(actor))

    @action(detail=True, methods=["post"], url_path="hod-action")
    def hod_action(self, request, pk=None):
        actor = self._actor()
        data_ser = HODActionSerializer(data=request.data)
        data_ser.is_valid(raise_exception=True)

        action_name = data_ser.validated_data["action"]
        notes = data_ser.validated_data.get("notes", "")
        forward_to_department_code = data_ser.validated_data.get(
            "forward_to_department_code"
        )

        data = apply_hod_action(
            indent_id=pk,
            actor=actor,
            action_name=action_name,
            notes=notes,
            forward_to_department_code=forward_to_department_code,
            request_user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="stock-breakdown")
    def stock_breakdown(self, request, pk=None):
        actor = self._actor()
        return Response(get_stock_breakdown_data(indent_id=pk, actor=actor))

    @action(detail=True, methods=["post"], url_path="check-stock")
    def check_stock_action(self, request, pk=None):
        actor = self._actor()
        return Response(
            check_stock_action(indent_id=pk, actor=actor, request_user=request.user)
        )

    @action(detail=True, methods=["post"], url_path="create-stock-entry")
    def create_stock_entry(self, request, pk=None):
        actor = self._actor()
        serializer = StockEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = create_stock_entry(
            indent_id=pk,
            actor=actor,
            request_user=request.user,
            item_lines=serializer.validated_data["items"],
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="ps-admin-categories")
    def ps_admin_categories(self, request):
        actor = self._actor()
        return Response(get_ps_admin_indents_by_category(actor))

    @action(detail=True, methods=["post"], url_path="ps-admin-action")
    def ps_admin_action(self, request, pk=None):
        actor = self._actor()
        serializer = PSAdminActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_name = serializer.validated_data["action"]
        notes = serializer.validated_data.get("notes", "")

        data = apply_ps_admin_action(
            indent_id=pk,
            actor=actor,
            action_name=action_name,
            notes=notes,
            request_user=request.user,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="confirm-delivery")
    def confirm_delivery_action(self, request, pk=None):
        actor = self._actor()
        data = confirm_delivery(indent_id=pk, actor=actor, request_user=request.user)
        return Response(data, status=status.HTTP_200_OK)


class MeViewSet(viewsets.ViewSet):
    """
    Returns identity + allowed acting roles for the authenticated user.
    This endpoint does NOT require X-Acting-Role.
    """

    def list(self, request):
        return Response(get_me_payload(request.user))


class StockCheckView(APIView):
    def get(self, request, item_id: int):
        required = request.query_params.get("required")
        if required is None:
            raise ValidationError({"required": "Query param required is required."})
        try:
            required_int = int(required)
        except ValueError as e:
            raise ValidationError({"required": "Must be an integer."}) from e
        if required_int < 0:
            raise ValidationError({"required": "Must be >= 0."})
        return Response(
            get_store_item_stock_check_status(item_id=item_id, required=required_int)
        )


class StockListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        department = require_depadmin_role(request)
        if isinstance(department, HttpResponseForbidden):
            return department

        stock_qs = Stock.objects.filter(department=department)
        serializer = StockSerializer(stock_qs, many=True)
        return Response(serializer.data)


class AvailableStockListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        department = require_depadmin_role(request)
        if isinstance(department, HttpResponseForbidden):
            return department

        stock_qs = Stock.objects.exclude(department=department)
        serializer = StockSerializer(stock_qs, many=True)
        return Response(serializer.data)


class TransferRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        depadmin_role = get_user_depadmin_role(request.user)
        ps_admin_role = get_user_ps_admin_role(request.user)

        if not depadmin_role and not ps_admin_role:
            return HttpResponseForbidden("Access Denied")

        if ps_admin_role:
            requests = TransferRequest.objects.filter(
                status=TransferRequest.Status.APPROVED
            )
        else:
            requests = TransferRequest.objects.filter(requested_by=request.user)
            requests = requests | TransferRequest.objects.filter(
                requested_from=depadmin_role
            )

        requests = (
            requests.select_related("stock", "requested_by")
            .order_by("-created_at")
            .distinct()
        )
        serializer = TransferRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        department = require_depadmin_role(request)
        if isinstance(department, HttpResponseForbidden):
            return department

        serializer = TransferRequestCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        stock = get_object_or_404(Stock, pk=serializer.validated_data["stock_id"])
        transfer_request = TransferRequest.objects.create(
            stock=stock,
            requested_by=request.user,
            requested_from=serializer.validated_data["requested_from"],
            requested_quantity=serializer.validated_data.get("requested_quantity", 1),
            status=TransferRequest.Status.PENDING,
        )
        response_serializer = TransferRequestSerializer(transfer_request)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class TransferRequestApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        department = require_depadmin_role(request)
        if isinstance(department, HttpResponseForbidden):
            return department

        transfer_request = get_object_or_404(
            TransferRequest.objects.select_related("stock", "requested_by"), pk=pk
        )

        if transfer_request.status != TransferRequest.Status.PENDING:
            return Response(
                {"detail": "Only pending requests can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if transfer_request.stock.department != department:
            return Response(
                {"detail": "Access Denied"},
                status=status.HTTP_403_FORBIDDEN,
            )

        requested_by_role = get_user_depadmin_role(transfer_request.requested_by)
        if not isinstance(requested_by_role, str) or not requested_by_role.startswith(
            "depadmin_"
        ):
            return Response(
                {"detail": "Invalid requester role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        destination_department = requested_by_role.replace("depadmin_", "dep_")
        requested_quantity = transfer_request.requested_quantity
        source_stock = transfer_request.stock

        if requested_quantity > source_stock.quantity:
            return Response(
                {"detail": "Requested quantity exceeds available stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            source_stock.quantity -= requested_quantity
            source_stock.save(update_fields=["quantity"])

            destination_stock, created = Stock.objects.get_or_create(
                stock_name=source_stock.stock_name,
                department=destination_department,
                defaults={"quantity": requested_quantity},
            )
            if not created:
                destination_stock.quantity += requested_quantity
                destination_stock.save(update_fields=["quantity"])

            transfer_request.status = TransferRequest.Status.APPROVED
            transfer_request.save(update_fields=["status"])

            TransferLog.objects.create(
                stock=source_stock,
                from_department=department,
                to_department=destination_department,
                approved_by=request.user,
                timestamp=now(),
            )

        serializer = TransferRequestSerializer(transfer_request)
        return Response(serializer.data)


class TransferRequestRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        department = require_depadmin_role(request)
        if isinstance(department, HttpResponseForbidden):
            return department

        transfer_request = get_object_or_404(
            TransferRequest.objects.select_related("stock"), pk=pk
        )

        if transfer_request.status != TransferRequest.Status.PENDING:
            return Response(
                {"detail": "Only pending requests can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if transfer_request.stock.department != department:
            return Response(
                {"detail": "Access Denied"},
                status=status.HTTP_403_FORBIDDEN,
            )

        transfer_request.status = TransferRequest.Status.REJECTED
        transfer_request.save(update_fields=["status"])

        serializer = TransferRequestSerializer(transfer_request)
        return Response(serializer.data)
