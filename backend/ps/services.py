from __future__ import annotations

from typing import Optional

from accounts.models import DepartmentInfo, HoldsDesignation

from accounts.models import ExtraInfo
from ps.models import CurrentStock, Indent


def check_stock(indent: Indent) -> bool:
    for line in indent.items.all():
        stock = CurrentStock.objects.filter(item=line.item).first()
        if not stock or stock.quantity < line.quantity:
            return False
    return True


def get_department_hod(department: DepartmentInfo) -> Optional[ExtraInfo]:
    hold = (
        HoldsDesignation.objects.select_related("working", "designation", "working__department")
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
        HoldsDesignation.objects.select_related("working", "designation", "working__department")
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
        HoldsDesignation.objects.select_related("working", "designation", "working__department")
        .filter(is_active=True, designation__name__icontains=name_contains)
        .first()
    )
    return hold.working if hold else None


def get_registrar_or_director() -> Optional[ExtraInfo]:
    return get_first_holder_by_designation("registrar") or get_first_holder_by_designation("director")


def get_accounts_admin() -> Optional[ExtraInfo]:
    return get_first_holder_by_designation("accounts")

