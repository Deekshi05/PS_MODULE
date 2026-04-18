from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from rest_framework.exceptions import PermissionDenied, ValidationError

from psmodule.accounts.models import DepartmentInfo, ExtraInfo, HoldsDesignation
from psmodule.models import (
    ActingRole,
    CurrentStock,
    Indent,
    IndentAudit,
    IndentItem,
    StockCheckStatus,
    StockEntry,
    StockEntryItem,
    StoreItem,
)
from psmodule.api.serializers import IndentSerializer


def get_extrainfo_for_user(user) -> ExtraInfo:
    try:
        return ExtraInfo.objects.select_related("department").get(user=user)
    except ExtraInfo.DoesNotExist as e:  # type: ignore[attr-defined]
        raise PermissionDenied("User missing ExtraInfo") from e


def has_designation(extrainfo: ExtraInfo, name_contains: str) -> bool:
    return HoldsDesignation.objects.filter(
        is_active=True,
        designation__name__icontains=name_contains,
        working=extrainfo,
    ).exists()


def is_user_hod(extrainfo: ExtraInfo) -> bool:
    # Treat common variants as department head
    return (
        HoldsDesignation.objects.filter(is_active=True, working=extrainfo)
        .filter(designation__name__icontains="hod")
        .exists()
        or HoldsDesignation.objects.filter(is_active=True, working=extrainfo)
        .filter(designation__name__icontains="dept head")
        .exists()
        or HoldsDesignation.objects.filter(is_active=True, working=extrainfo)
        .filter(designation__name__icontains="head of department")
        .exists()
    )


def validate_store_item_ids(item_ids: Sequence[int]) -> None:
    item_ids_set = set(item_ids)
    if not item_ids_set:
        return

    existing = set(
        StoreItem.objects.filter(id__in=item_ids_set).values_list("id", flat=True)
    )
    missing = sorted([i for i in item_ids_set if i not in existing])
    if missing:
        raise ValidationError({"item_id": f"Unknown item_ids: {missing}"})


def get_department_hod(department: DepartmentInfo) -> Optional[ExtraInfo]:
    hold = (
        HoldsDesignation.objects.select_related(
            "working", "designation", "working__department"
        )
        .filter(
            is_active=True,
            designation__name__iregex=r"(hod|dept head|head of department)",
            working__department=department,
        )
        .first()
    )
    return hold.working if hold else None


def get_department_depadmin(department: DepartmentInfo) -> Optional[ExtraInfo]:
    hold = (
        HoldsDesignation.objects.select_related(
            "working", "designation", "working__department"
        )
        .filter(
            is_active=True,
            designation__name__icontains="depadmin",
            working__department=department,
        )
        .first()
    )
    return hold.working if hold else None


def get_first_holder_by_designation(name_contains: str) -> Optional[ExtraInfo]:
    hold = (
        HoldsDesignation.objects.select_related(
            "working", "designation", "working__department"
        )
        .filter(is_active=True, designation__name__icontains=name_contains)
        .first()
    )
    return hold.working if hold else None


def get_registrar_or_director() -> Optional[ExtraInfo]:
    return get_first_holder_by_designation(
        "registrar"
    ) or get_first_holder_by_designation("director")


def get_accounts_admin() -> Optional[ExtraInfo]:
    return get_first_holder_by_designation("accounts")


def get_department_by_code(code: str) -> DepartmentInfo:
    dept = DepartmentInfo.objects.filter(code__iexact=code).first()
    if not dept:
        raise ValidationError(
            {"forward_to_department_code": "Unknown department code."}
        )
    return dept


def check_stock_availability_for_indent_id(indent_id: int) -> bool:
    """
    Read-only stock check.

    Returns True only if, for every indent line, available stock >= requested quantity.
    """
    lines = list(
        IndentItem.objects.filter(indent_id=indent_id).values("item_id", "quantity")
    )
    if not lines:
        return False

    item_ids = [l["item_id"] for l in lines]
    stock_map: Dict[int, int] = dict(
        CurrentStock.objects.filter(item_id__in=item_ids).values_list(
            "item_id", "quantity"
        )
    )

    for l in lines:
        available = stock_map.get(l["item_id"], 0)
        if available < l["quantity"]:
            return False
    return True


def get_indent_data(indent_id: int) -> dict:
    indent = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .get(id=indent_id)
    )
    return IndentSerializer(indent).data


def get_indent_for_hod_action(indent_id: int, actor) -> Indent:
    if actor.role not in (
        ActingRole.DEPADMIN,
        ActingRole.HOD,
        ActingRole.REGISTRAR,
        ActingRole.DIRECTOR,
    ):
        raise PermissionDenied("Not allowed to perform approval actions.")

    indent = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(id=indent_id, current_approver=actor.extrainfo)
        .first()
    )
    if not indent:
        raise PermissionDenied("You are not the current approver for this indent.")
    return indent


def get_indent_for_stock_check(indent_id: int, actor) -> Indent:
    if actor.role != ActingRole.DEPADMIN:
        raise PermissionDenied("Only DepAdmin can check stock.")

    indent = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(id=indent_id, current_approver=actor.extrainfo)
        .first()
    )
    if not indent:
        raise PermissionDenied("Cannot check this indent.")

    if indent.department_id != actor.extrainfo.department_id:
        raise PermissionDenied("Cannot check other department's indent.")
    return indent


def get_stock_breakdown_data(indent_id: int, actor) -> dict:
    if actor.role not in (ActingRole.DEPADMIN, ActingRole.HOD):
        raise PermissionDenied("Only DepAdmin/HOD can view stock breakdown.")

    indent = (
        Indent.objects.select_related("department")
        .filter(id=indent_id, current_approver=actor.extrainfo)
        .first()
    )
    if not indent:
        raise PermissionDenied("Cannot view this indent.")

    if indent.department_id != actor.extrainfo.department_id:
        raise PermissionDenied("Cannot view other department's indent.")

    lines = list(
        IndentItem.objects.filter(indent_id=indent_id)
        .select_related("item")
        .values("item_id", "quantity", "item__name")
    )
    item_ids = [l["item_id"] for l in lines]
    stock_map: Dict[int, int] = dict(
        CurrentStock.objects.filter(item_id__in=item_ids).values_list(
            "item_id", "quantity"
        )
    )

    breakdown: List[dict] = []
    for line in lines:
        requested = line["quantity"]
        available = stock_map.get(line["item_id"], 0)
        ok = available >= requested
        breakdown.append(
            {
                "item_id": line["item_id"],
                "item_name": line["item__name"],
                "requested_qty": requested,
                "available_qty": available,
                "ok": ok,
            }
        )

    return {
        "indent_id": indent.id,
        "all_available": all(b["ok"] for b in breakdown),
        "items": breakdown,
    }


def get_indents_for_actor_data(actor) -> List[dict]:
    qs = Indent.objects.select_related(
        "indenter", "department", "current_approver"
    ).prefetch_related("items__item")
    if actor.role == ActingRole.EMPLOYEE:
        qs = qs.filter(indenter=actor.extrainfo)
    elif actor.role == ActingRole.PS_ADMIN:
        qs = qs.filter(
            status__in=[
                Indent.Status.EXTERNAL_PROCUREMENT,
                Indent.Status.APPROVED,
                Indent.Status.BIDDING,
                Indent.Status.PURCHASED,
                Indent.Status.STOCK_ENTRY,
                Indent.Status.STOCKED,
            ]
        )
    elif actor.role in (
        ActingRole.DEPADMIN,
        ActingRole.HOD,
        ActingRole.REGISTRAR,
        ActingRole.DIRECTOR,
    ):
        qs = qs.filter(current_approver=actor.extrainfo)
    else:
        raise PermissionDenied("Unauthorized")

    qs = qs.order_by("-updated_at")
    return IndentSerializer(qs, many=True).data


def get_indent_decisions_for_actor_data(actor, user) -> List[dict]:
    if actor.role == ActingRole.EMPLOYEE:
        raise PermissionDenied("Only approver roles can view decisions.")

    indent_ids = (
        IndentAudit.objects.filter(
            user=user,
            acting_role=actor.role,
            action__in=["APPROVE", "REJECT"],
        )
        .order_by("-created_at")
        .values_list("indent_id", flat=True)
        .distinct()
    )
    qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(id__in=indent_ids)
        .order_by("-updated_at")
    )
    return IndentSerializer(qs, many=True).data


def get_me_payload(user) -> dict:
    extrainfo = get_extrainfo_for_user(user)

    allowed = [ActingRole.EMPLOYEE]
    if has_designation(extrainfo, "depadmin"):
        allowed.append(ActingRole.DEPADMIN)
    if has_designation(extrainfo, "ps admin"):
        allowed.append(ActingRole.PS_ADMIN)
    if is_user_hod(extrainfo):
        allowed.append(ActingRole.HOD)
    if has_designation(extrainfo, "registrar"):
        allowed.append(ActingRole.REGISTRAR)
    if has_designation(extrainfo, "director"):
        allowed.append(ActingRole.DIRECTOR)

    return {
        "user": {"id": user.id, "username": user.username},
        "department": {
            "id": extrainfo.department_id,
            "code": extrainfo.department.code,
        },
        "allowed_roles": allowed,
    }


def get_store_item_stock_check_status(item_id: int, required: int) -> dict:
    item = StoreItem.objects.filter(id=item_id).first()
    if not item:
        raise ValidationError({"item_id": "Unknown item."})

    stock = CurrentStock.objects.filter(item=item).first()
    available = stock.quantity if stock else 0

    if available >= required:
        check_status = StockCheckStatus.AVAILABLE
    elif available > 0:
        check_status = StockCheckStatus.PARTIAL
    else:
        check_status = StockCheckStatus.NOT_AVAILABLE

    return {
        "item_id": item.id,
        "item_name": item.name,
        "available": available,
        "required": required,
        "status": check_status.value,
    }


def get_procurement_ready_indents_for_actor_data(actor) -> List[dict]:
    if actor.role not in (ActingRole.DEPADMIN, ActingRole.PS_ADMIN):
        raise PermissionDenied(
            "Only DepAdmin/PS Admin can view procurement-ready indents."
        )

    qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(status__in=[Indent.Status.EXTERNAL_PROCUREMENT, Indent.Status.APPROVED])
    )

    if actor.role == ActingRole.DEPADMIN:
        qs = qs.filter(department=actor.extrainfo.department)

    return IndentSerializer(qs.order_by("-updated_at"), many=True).data


def get_indent_for_stock_entry(indent_id: int, actor) -> Indent:
    if actor.role not in (ActingRole.DEPADMIN, ActingRole.PS_ADMIN):
        raise PermissionDenied("Only DepAdmin/PS Admin can create stock entry.")

    indent = (
        Indent.objects.select_related("department")
        .prefetch_related("items")
        .filter(id=indent_id)
        .first()
    )
    if not indent:
        raise ValidationError({"detail": "Indent not found."})

    if indent.status != Indent.Status.PURCHASED:
        raise ValidationError(
            {"detail": "Stock entry is allowed only for purchased indents."}
        )

    if not indent.delivery_confirmed:
        raise ValidationError(
            {"detail": "Delivery must be confirmed before stock entry."}
        )

    if (
        actor.role == ActingRole.DEPADMIN
        and indent.department_id != actor.extrainfo.department_id
    ):
        raise PermissionDenied("Cannot create stock entry for another department.")

    return indent


def get_ps_admin_indents_by_category(actor) -> dict:
    """Get indents categorized by procurement stage for PS_ADMIN dashboard"""
    if actor.role != ActingRole.PS_ADMIN:
        raise PermissionDenied("Only PS_ADMIN can access this view.")

    # Pending: APPROVED indents ready for bidding
    pending_qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(status=Indent.Status.APPROVED)
        .order_by("-updated_at")
    )

    # Bidding: Indents in BIDDING status
    bidding_qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(status=Indent.Status.BIDDING)
        .order_by("-updated_at")
    )

    # Purchased: Indents in PURCHASED status (awaiting/confirmed delivery)
    purchased_qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(status=Indent.Status.PURCHASED)
        .order_by("-updated_at")
    )

    # Stock entry: Indents moved to stock entry stage
    stock_entry_qs = (
        Indent.objects.select_related("indenter", "department", "current_approver")
        .prefetch_related("items__item")
        .filter(status__in=[Indent.Status.STOCK_ENTRY, Indent.Status.STOCKED])
        .order_by("-updated_at")
    )

    return {
        "pending": IndentSerializer(pending_qs, many=True).data,
        "bidding": IndentSerializer(bidding_qs, many=True).data,
        "purchased": IndentSerializer(purchased_qs, many=True).data,
        "stock_entry": IndentSerializer(stock_entry_qs, many=True).data,
    }


# --- Writes / ORM mutations (called from services) ---


def create_submitted_indent(
    *,
    indenter,
    department,
    purpose: str,
    justification: str,
    estimated_cost,
) -> Indent:
    return Indent.objects.create(
        indenter=indenter,
        department=department,
        purpose=purpose,
        justification=justification,
        estimated_cost=estimated_cost,
        status=Indent.Status.SUBMITTED,
    )


def create_indent_line_items(indent: Indent, item_lines: list) -> None:
    for line in item_lines:
        IndentItem.objects.create(
            indent=indent,
            item_id=int(line["item_id"]),
            quantity=int(line["quantity"]),
            estimated_cost=line.get("estimated_cost"),
        )


def create_indent_audit_event(
    *,
    indent: Indent,
    user,
    acting_role: str,
    action: str,
    notes: str = "",
) -> IndentAudit:
    return IndentAudit.objects.create(
        indent=indent,
        user=user,
        acting_role=acting_role,
        action=action,
        notes=notes,
    )


def get_indent_by_id(indent_id: int) -> Indent:
    return Indent.objects.get(id=indent_id)


def get_indent_for_delivery_confirmation(indent_id: int, extrainfo) -> Optional[Indent]:
    return (
        Indent.objects.select_related("indenter")
        .filter(id=indent_id, indenter=extrainfo)
        .first()
    )


def create_stock_entry_with_line_map(
    *,
    indent: Indent,
    request_user,
    acting_role: str,
    notes: str,
    payload_map: dict[int, int],
) -> StockEntry:
    entry = StockEntry.objects.create(
        indent=indent,
        created_by=request_user,
        acting_role=acting_role,
        notes=notes or "",
    )
    for item_id, qty in payload_map.items():
        StockEntryItem.objects.create(
            stock_entry=entry, item_id=item_id, quantity=qty
        )
        stock, _ = CurrentStock.objects.get_or_create(
            item_id=item_id, defaults={"quantity": 0}
        )
        stock.quantity += qty
        stock.save(update_fields=["quantity", "updated_at"])
    return entry


def create_stock_entry_from_indent_items_ps_admin(
    *,
    indent: Indent,
    request_user,
    acting_role: str,
    notes: str,
) -> StockEntry:
    entry = StockEntry.objects.create(
        indent=indent,
        created_by=request_user,
        acting_role=acting_role,
        notes=notes or "",
    )
    for item_line in indent.items.all():
        StockEntryItem.objects.create(
            stock_entry=entry,
            item_id=item_line.item_id,
            quantity=item_line.quantity,
        )
        stock, _ = CurrentStock.objects.get_or_create(
            item_id=item_line.item_id, defaults={"quantity": 0}
        )
        stock.quantity += item_line.quantity
        stock.save(update_fields=["quantity", "updated_at"])
    return entry


def save_indent(indent: Indent, update_fields: list[str]) -> None:
    indent.save(update_fields=update_fields)
