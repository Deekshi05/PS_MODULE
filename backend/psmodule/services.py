from __future__ import annotations

from typing import Any, Dict, Optional

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from psmodule.models import ActingRole, Indent
from psmodule.api.serializers import StockEntrySerializer
from psmodule.selectors import (
    check_stock_availability_for_indent_id,
    create_indent_audit_event,
    create_indent_line_items,
    create_stock_entry_from_indent_items_ps_admin,
    create_stock_entry_with_line_map,
    create_submitted_indent,
    get_department_depadmin,
    get_department_by_code,
    get_department_hod,
    get_first_holder_by_designation,
    get_indent_by_id,
    get_indent_data,
    get_indent_for_delivery_confirmation,
    get_indent_for_hod_action,
    get_indent_for_stock_check,
    get_indent_for_stock_entry,
    save_indent,
    validate_store_item_ids,
)


def create_indent(validated_data: Dict[str, Any], actor, request_user) -> dict:
    if actor.role != ActingRole.EMPLOYEE:
        raise ValidationError("Only employees can submit indents.")

    item_lines = validated_data["items"]
    item_ids = [int(i["item_id"]) for i in item_lines]
    validate_store_item_ids(item_ids)

    indenter = actor.extrainfo
    department = indenter.department

    indent = create_submitted_indent(
        indenter=indenter,
        department=department,
        purpose=validated_data["purpose"],
        justification=validated_data.get("justification", ""),
        estimated_cost=validated_data.get("estimated_cost"),
    )

    create_indent_line_items(indent, item_lines)

    indent.stock_available = check_stock_availability_for_indent_id(indent.id)

    hod = get_department_hod(department)
    indent.current_approver = hod if hod else get_department_depadmin(department)
    indent.status = Indent.Status.SUBMITTED
    save_indent(
        indent,
        ["stock_available", "current_approver", "status", "updated_at"],
    )

    create_indent_audit_event(
        indent=indent,
        user=request_user,
        acting_role=actor.role,
        action="SUBMIT",
        notes="",
    )

    return get_indent_data(indent.id)


def apply_hod_action(
    indent_id: int,
    actor,
    action_name: str,
    notes: str = "",
    forward_to_department_code: Optional[str] = None,
    request_user=None,
) -> dict:
    indent = get_indent_for_hod_action(indent_id, actor)

    if action_name == "APPROVE":
        if actor.role == ActingRole.DEPADMIN:
            if indent.status != Indent.Status.STOCK_CHECKED:
                raise ValidationError(
                    {"detail": "Please check stock before approving."}
                )
            indent.status = (
                Indent.Status.INTERNAL_ISSUED
                if indent.stock_available
                else Indent.Status.EXTERNAL_PROCUREMENT
            )
            indent.current_approver = None
            save_indent(indent, ["status", "current_approver", "updated_at"])

        elif actor.role == ActingRole.HOD:
            next_approver = get_department_depadmin(indent.department)
            if not next_approver:
                raise ValidationError(
                    {"detail": "No DepAdmin found for this department."}
                )
            indent.current_approver = next_approver
            indent.status = Indent.Status.FORWARDED
            save_indent(indent, ["status", "current_approver", "updated_at"])

        elif actor.role in (ActingRole.REGISTRAR, ActingRole.DIRECTOR):
            indent.status = Indent.Status.APPROVED
            indent.current_approver = None
            save_indent(indent, ["status", "current_approver", "updated_at"])
        else:
            raise ValidationError({"action": "Invalid approver role"})

    elif action_name == "REJECT":
        indent.status = Indent.Status.REJECTED
        indent.current_approver = None
        save_indent(indent, ["status", "current_approver", "updated_at"])

    elif action_name == "FORWARD":
        dept_code = (forward_to_department_code or "").strip()
        if dept_code:
            target_dept = get_department_by_code(dept_code)
            target_hod = get_department_hod(target_dept)
            indent.department = target_dept
            indent.current_approver = target_hod
            indent.status = (
                Indent.Status.FORWARDED if target_hod else Indent.Status.SUBMITTED
            )
            save_indent(
                indent,
                ["department", "current_approver", "status", "updated_at"],
            )
        else:
            if actor.role != ActingRole.DEPADMIN:
                raise PermissionDenied("Only DepAdmin can forward to Director.")
            next_approver = get_first_holder_by_designation("director")
            if not next_approver:
                raise ValidationError({"detail": "No Director found to forward to."})
            indent.current_approver = next_approver
            indent.status = Indent.Status.FORWARDED_TO_DIRECTOR
            save_indent(indent, ["current_approver", "status", "updated_at"])
    else:
        raise ValidationError({"action": "Invalid action"})

    create_indent_audit_event(
        indent=indent,
        user=request_user,
        acting_role=actor.role,
        action=action_name,
        notes=notes,
    )

    return get_indent_data(indent.id)


def check_stock_action(indent_id: int, actor, request_user) -> dict:
    indent = get_indent_for_stock_check(indent_id, actor)

    indent.stock_available = check_stock_availability_for_indent_id(indent.id)
    indent.procurement_type = (
        Indent.ProcurementType.INTERNAL
        if indent.stock_available
        else Indent.ProcurementType.EXTERNAL
    )
    indent.status = Indent.Status.STOCK_CHECKED
    save_indent(
        indent,
        ["stock_available", "procurement_type", "status", "updated_at"],
    )

    create_indent_audit_event(
        indent=indent,
        user=request_user,
        acting_role=actor.role,
        action="CHECK_STOCK",
        notes="",
    )

    return get_indent_data(indent.id)


def create_stock_entry(
    indent_id: int,
    actor,
    request_user,
    item_lines: list[dict],
    notes: str = "",
) -> dict:
    indent = get_indent_for_stock_entry(indent_id, actor)

    requested_map = {
        int(line.item_id): int(line.quantity) for line in indent.items.all()
    }
    payload_map = {int(line["item_id"]): int(line["quantity"]) for line in item_lines}

    if set(requested_map.keys()) != set(payload_map.keys()):
        raise ValidationError(
            {"items": "Payload items must exactly match indent items."}
        )

    for item_id, qty in payload_map.items():
        if qty <= 0:
            raise ValidationError(
                {"items": f"Quantity must be > 0 for item_id {item_id}."}
            )
        if qty != requested_map[item_id]:
            raise ValidationError(
                {"items": f"Quantity mismatch for item_id {item_id}."}
            )

    with transaction.atomic():
        entry = create_stock_entry_with_line_map(
            indent=indent,
            request_user=request_user,
            acting_role=actor.role,
            notes=notes or "",
            payload_map=payload_map,
        )

        indent.status = Indent.Status.STOCK_ENTRY
        indent.current_approver = None
        save_indent(indent, ["status", "current_approver", "updated_at"])

        create_indent_audit_event(
            indent=indent,
            user=request_user,
            acting_role=actor.role,
            action="STOCK_ENTRY",
            notes=notes or "",
        )

    return {
        "indent": get_indent_data(indent.id),
        "stock_entry": StockEntrySerializer(entry).data,
    }


def apply_ps_admin_action(
    indent_id: int,
    actor,
    action_name: str,
    notes: str = "",
    request_user=None,
) -> dict:
    """Handle PS_ADMIN actions: BIDDING, PURCHASE and STOCK_ENTRY."""
    if actor.role != ActingRole.PS_ADMIN:
        raise PermissionDenied("Only PS_ADMIN can perform this action.")

    indent = get_indent_by_id(indent_id)

    if action_name == "BIDDING":
        if indent.status != Indent.Status.APPROVED:
            raise ValidationError(
                {"detail": "Only APPROVED indents can move to BIDDING status."}
            )
        indent.status = Indent.Status.BIDDING
        save_indent(indent, ["status", "updated_at"])

    elif action_name == "PURCHASE":
        if indent.status not in (Indent.Status.APPROVED, Indent.Status.BIDDING):
            raise ValidationError(
                {
                    "detail": "Only APPROVED or BIDDING indents can be marked as PURCHASED."
                }
            )

        indent.status = Indent.Status.PURCHASED
        indent.delivery_confirmed = False
        indent.current_approver = None
        save_indent(
            indent,
            [
                "status",
                "delivery_confirmed",
                "current_approver",
                "updated_at",
            ],
        )

    elif action_name == "STOCK_ENTRY":
        if indent.status != Indent.Status.PURCHASED:
            raise ValidationError(
                {"detail": "Only PURCHASED indents can be moved to STOCK_ENTRY."}
            )

        if not indent.delivery_confirmed:
            raise ValidationError(
                {"detail": "Delivery must be confirmed by employee before stock entry."}
            )

        with transaction.atomic():
            create_stock_entry_from_indent_items_ps_admin(
                indent=indent,
                request_user=request_user,
                acting_role=actor.role,
                notes=notes or "",
            )

            indent.status = Indent.Status.STOCK_ENTRY
            indent.current_approver = None
            save_indent(indent, ["status", "current_approver", "updated_at"])

    else:
        raise ValidationError({"action": "Invalid action"})

    create_indent_audit_event(
        indent=indent,
        user=request_user,
        acting_role=actor.role,
        action=action_name,
        notes=notes,
    )

    return get_indent_data(indent.id)


def confirm_delivery(indent_id: int, actor, request_user=None) -> dict:
    """Allow employees to confirm delivery for their purchased indents."""
    if actor.role != ActingRole.EMPLOYEE:
        raise PermissionDenied("Only employees can confirm delivery.")

    indent = get_indent_for_delivery_confirmation(indent_id, actor.extrainfo)
    if not indent:
        raise PermissionDenied("You can only confirm delivery for your own indents.")

    if indent.status != Indent.Status.PURCHASED:
        raise ValidationError(
            {"detail": "Delivery can only be confirmed for PURCHASED indents."}
        )

    if indent.delivery_confirmed:
        raise ValidationError({"detail": "Delivery is already confirmed."})

    indent.delivery_confirmed = True
    save_indent(indent, ["delivery_confirmed", "updated_at"])

    create_indent_audit_event(
        indent=indent,
        user=request_user,
        acting_role=actor.role,
        action="CONFIRM_DELIVERY",
        notes="",
    )

    return get_indent_data(indent.id)
