from __future__ import annotations

from dataclasses import dataclass

from accounts.models import ExtraInfo, HoldsDesignation


class ActingRole:
    EMPLOYEE = "EMPLOYEE"
    DEPADMIN = "DEPADMIN"
    HOD = "HOD"
    REGISTRAR = "REGISTRAR"
    DIRECTOR = "DIRECTOR"


def get_acting_role(request) -> str:
    role = (request.headers.get("X-Acting-Role") or "").strip().upper()
    return role


def require_extrainfo(user) -> ExtraInfo:
    try:
        return user.extrainfo
    except ExtraInfo.DoesNotExist as e:  # type: ignore[attr-defined]
        raise PermissionError("User missing ExtraInfo") from e


def user_is_hod(extrainfo: ExtraInfo) -> bool:
    # Treat common variants as department head
    return HoldsDesignation.objects.filter(is_active=True, working=extrainfo).filter(
        designation__name__icontains="hod"
    ).exists() or HoldsDesignation.objects.filter(is_active=True, working=extrainfo).filter(
        designation__name__icontains="dept head"
    ).exists() or HoldsDesignation.objects.filter(is_active=True, working=extrainfo).filter(
        designation__name__icontains="head of department"
    ).exists()

def user_has_designation(extrainfo: ExtraInfo, name_contains: str) -> bool:
    return HoldsDesignation.objects.filter(
        is_active=True,
        designation__name__icontains=name_contains,
        working=extrainfo,
    ).exists()


@dataclass(frozen=True)
class ActorContext:
    role: str
    extrainfo: ExtraInfo


def get_actor_context(request) -> ActorContext:
    extrainfo = require_extrainfo(request.user)
    role = get_acting_role(request)
    if role == ActingRole.EMPLOYEE:
        return ActorContext(role=role, extrainfo=extrainfo)
    if role == ActingRole.DEPADMIN and user_has_designation(extrainfo, "depadmin"):
        return ActorContext(role=role, extrainfo=extrainfo)
    if role == ActingRole.HOD and user_is_hod(extrainfo):
        return ActorContext(role=role, extrainfo=extrainfo)
    if role == ActingRole.REGISTRAR and user_has_designation(extrainfo, "registrar"):
        return ActorContext(role=role, extrainfo=extrainfo)
    if role == ActingRole.DIRECTOR and user_has_designation(extrainfo, "director"):
        return ActorContext(role=role, extrainfo=extrainfo)
    raise PermissionError("Invalid or unauthorized acting role")

