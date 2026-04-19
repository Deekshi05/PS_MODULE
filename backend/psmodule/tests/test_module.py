from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, ValidationError

from psmodule.accounts.models import DepartmentInfo, Designation, ExtraInfo, HoldsDesignation
from psmodule.models import (
    ActingRole,
    CurrentStock,
    Indent,
    IndentAudit,
    IndentItem,
    StockEntry,
    StoreItem,
)
from psmodule.department_stock.models import Stock as DepartmentStock
from psmodule.services import confirm_delivery, create_stock_entry, delete_indent_draft


class WorkflowPs002StockEntryTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.dept = DepartmentInfo.objects.create(code="CSE", name="Computer Science")
        self.other_dept = DepartmentInfo.objects.create(code="ECE", name="Electronics")

        self.depadmin_designation = Designation.objects.create(name="DepAdmin CSE")
        self.ps_admin_designation = Designation.objects.create(name="PS Admin")

        self.depadmin_user = User.objects.create_user(
            username="depadmin", password="pass1234"
        )
        self.ps_admin_user = User.objects.create_user(
            username="psadmin", password="pass1234"
        )
        self.employee_user = User.objects.create_user(
            username="employee", password="pass1234"
        )

        self.depadmin_info = ExtraInfo.objects.create(
            user=self.depadmin_user, department=self.dept, employee_id="depadmin"
        )
        self.ps_admin_info = ExtraInfo.objects.create(
            user=self.ps_admin_user, department=self.dept, employee_id="psadmin"
        )
        self.employee_info = ExtraInfo.objects.create(
            user=self.employee_user, department=self.dept, employee_id="employee"
        )

        HoldsDesignation.objects.create(
            designation=self.depadmin_designation,
            working=self.depadmin_info,
            is_active=True,
        )
        HoldsDesignation.objects.create(
            designation=self.ps_admin_designation,
            working=self.ps_admin_info,
            is_active=True,
        )

        self.item1 = StoreItem.objects.create(name="Pen", unit="nos")
        self.item2 = StoreItem.objects.create(name="A4 Paper", unit="ream")
        CurrentStock.objects.create(item=self.item1, quantity=10)
        CurrentStock.objects.create(item=self.item2, quantity=3)

        self.indent = Indent.objects.create(
            indenter=self.employee_info,
            department=self.dept,
            purpose="Procure stationery",
            status=Indent.Status.PURCHASED,
            delivery_confirmed=True,
        )
        IndentItem.objects.create(indent=self.indent, item=self.item1, quantity=5)
        IndentItem.objects.create(indent=self.indent, item=self.item2, quantity=2)

        DepartmentStock.objects.create(
            stock_name="Pen", department="dep_cse", quantity=100
        )
        DepartmentStock.objects.create(
            stock_name="A4 Paper", department="dep_cse", quantity=50
        )

    def _actor(self, role, extrainfo):
        return SimpleNamespace(role=role, extrainfo=extrainfo)

    def test_ps_admin_can_create_stock_entry_and_increase_inventory(self):
        actor = self._actor(ActingRole.PS_ADMIN, self.ps_admin_info)

        result = create_stock_entry(
            indent_id=self.indent.id,
            actor=actor,
            request_user=self.ps_admin_user,
            item_lines=[
                {"item_id": self.item1.id, "quantity": 5},
                {"item_id": self.item2.id, "quantity": 2},
            ],
            notes="Goods received from supplier",
        )

        self.indent.refresh_from_db()
        self.assertEqual(self.indent.status, Indent.Status.STOCK_ENTRY)

        stock1 = CurrentStock.objects.get(item=self.item1)
        stock2 = CurrentStock.objects.get(item=self.item2)
        self.assertEqual(stock1.quantity, 15)
        self.assertEqual(stock2.quantity, 5)

        self.assertEqual(StockEntry.objects.count(), 1)
        entry = StockEntry.objects.first()
        self.assertEqual(entry.acting_role, ActingRole.PS_ADMIN)
        self.assertEqual(entry.items.count(), 2)
        self.assertEqual(
            IndentAudit.objects.filter(
                indent=self.indent, action="STOCK_ENTRY"
            ).count(),
            1,
        )
        self.assertEqual(result["indent"]["status"], Indent.Status.STOCK_ENTRY)

        ds_pen = DepartmentStock.objects.get(stock_name="Pen", department="dep_cse")
        ds_paper = DepartmentStock.objects.get(stock_name="A4 Paper", department="dep_cse")
        self.assertEqual(ds_pen.quantity, 105)
        self.assertEqual(ds_paper.quantity, 52)

    def test_reject_when_delivery_not_confirmed(self):
        self.indent.delivery_confirmed = False
        self.indent.save(update_fields=["delivery_confirmed", "updated_at"])

        actor = self._actor(ActingRole.PS_ADMIN, self.ps_admin_info)

        with self.assertRaises(ValidationError):
            create_stock_entry(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.ps_admin_user,
                item_lines=[
                    {"item_id": self.item1.id, "quantity": 5},
                    {"item_id": self.item2.id, "quantity": 2},
                ],
            )

    def test_depadmin_cannot_create_stock_entry_for_other_department(self):
        other_indent = Indent.objects.create(
            indenter=self.employee_info,
            department=self.other_dept,
            purpose="Other dept indent",
            status=Indent.Status.PURCHASED,
            delivery_confirmed=True,
        )
        IndentItem.objects.create(indent=other_indent, item=self.item1, quantity=1)

        actor = self._actor(ActingRole.DEPADMIN, self.depadmin_info)

        with self.assertRaises(PermissionDenied):
            create_stock_entry(
                indent_id=other_indent.id,
                actor=actor,
                request_user=self.depadmin_user,
                item_lines=[{"item_id": self.item1.id, "quantity": 1}],
            )

    def test_reject_when_payload_item_ids_do_not_match_indent(self):
        actor = self._actor(ActingRole.PS_ADMIN, self.ps_admin_info)

        with self.assertRaises(ValidationError):
            create_stock_entry(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.ps_admin_user,
                item_lines=[{"item_id": self.item1.id, "quantity": 5}],
            )

        self.assertEqual(StockEntry.objects.count(), 0)

    def test_reject_when_quantity_mismatch(self):
        actor = self._actor(ActingRole.PS_ADMIN, self.ps_admin_info)

        with self.assertRaises(ValidationError):
            create_stock_entry(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.ps_admin_user,
                item_lines=[
                    {"item_id": self.item1.id, "quantity": 4},
                    {"item_id": self.item2.id, "quantity": 2},
                ],
            )

        self.assertEqual(CurrentStock.objects.get(item=self.item1).quantity, 10)
        self.assertEqual(StockEntry.objects.count(), 0)

    def test_reject_when_indent_status_not_procurement_ready(self):
        self.indent.status = Indent.Status.REJECTED
        self.indent.save(update_fields=["status", "updated_at"])

        actor = self._actor(ActingRole.PS_ADMIN, self.ps_admin_info)

        with self.assertRaises(ValidationError):
            create_stock_entry(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.ps_admin_user,
                item_lines=[
                    {"item_id": self.item1.id, "quantity": 5},
                    {"item_id": self.item2.id, "quantity": 2},
                ],
            )

    def test_employee_cannot_create_stock_entry(self):
        actor = self._actor(ActingRole.EMPLOYEE, self.employee_info)

        with self.assertRaises(PermissionDenied):
            create_stock_entry(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.employee_user,
                item_lines=[
                    {"item_id": self.item1.id, "quantity": 5},
                    {"item_id": self.item2.id, "quantity": 2},
                ],
            )


class WorkflowPsDeliveryConfirmationTests(TestCase):
    def setUp(self):
        User = get_user_model()

        self.dept = DepartmentInfo.objects.create(code="ME", name="Mechanical")
        self.other_dept = DepartmentInfo.objects.create(code="CE", name="Civil")

        self.employee_user = User.objects.create_user(
            username="employee2", password="pass1234"
        )
        self.other_user = User.objects.create_user(
            username="employee3", password="pass1234"
        )

        self.employee_info = ExtraInfo.objects.create(
            user=self.employee_user, department=self.dept, employee_id="employee2"
        )
        self.other_info = ExtraInfo.objects.create(
            user=self.other_user, department=self.other_dept, employee_id="employee3"
        )

        self.indent = Indent.objects.create(
            indenter=self.employee_info,
            department=self.dept,
            purpose="Confirm delivery flow",
            status=Indent.Status.PURCHASED,
            delivery_confirmed=False,
        )

    def _actor(self, role, extrainfo):
        return SimpleNamespace(role=role, extrainfo=extrainfo)

    def test_employee_can_confirm_delivery_for_own_purchased_indent(self):
        actor = self._actor(ActingRole.EMPLOYEE, self.employee_info)

        data = confirm_delivery(
            indent_id=self.indent.id,
            actor=actor,
            request_user=self.employee_user,
        )

        self.indent.refresh_from_db()
        self.assertTrue(self.indent.delivery_confirmed)
        self.assertEqual(data["delivery_confirmed"], True)

    def test_employee_cannot_confirm_delivery_for_other_users_indent(self):
        actor = self._actor(ActingRole.EMPLOYEE, self.other_info)

        with self.assertRaises(PermissionDenied):
            confirm_delivery(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.other_user,
            )

    def test_delivery_confirmation_requires_purchased_state(self):
        self.indent.status = Indent.Status.BIDDING
        self.indent.save(update_fields=["status", "updated_at"])
        actor = self._actor(ActingRole.EMPLOYEE, self.employee_info)

        with self.assertRaises(ValidationError):
            confirm_delivery(
                indent_id=self.indent.id,
                actor=actor,
                request_user=self.employee_user,
            )


class DeleteDraftIndentTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.dept = DepartmentInfo.objects.create(code="CSE", name="Computer Science")
        self.employee_user = User.objects.create_user(username="emp_del", password="pass1234")
        self.other_user = User.objects.create_user(username="other_del", password="pass1234")
        self.employee_info = ExtraInfo.objects.create(
            user=self.employee_user, department=self.dept, employee_id="emp_del"
        )
        self.other_info = ExtraInfo.objects.create(
            user=self.other_user, department=self.dept, employee_id="other_del"
        )
        self.draft = Indent.objects.create(
            indenter=self.employee_info,
            department=self.dept,
            purpose="Draft to delete",
            status=Indent.Status.DRAFT,
        )

    def _actor(self, role, extrainfo):
        return SimpleNamespace(role=role, extrainfo=extrainfo)

    def test_employee_deletes_own_draft(self):
        actor = self._actor(ActingRole.EMPLOYEE, self.employee_info)
        pk = self.draft.id
        delete_indent_draft(pk, actor, self.employee_user)
        self.assertFalse(Indent.objects.filter(pk=pk).exists())

    def test_cannot_delete_submitted_indent(self):
        self.draft.status = Indent.Status.SUBMITTED
        self.draft.save(update_fields=["status", "updated_at"])
        actor = self._actor(ActingRole.EMPLOYEE, self.employee_info)
        with self.assertRaises(ValidationError):
            delete_indent_draft(self.draft.id, actor, self.employee_user)

    def test_other_employee_cannot_delete_draft(self):
        actor = self._actor(ActingRole.EMPLOYEE, self.other_info)
        with self.assertRaises(ValidationError):
            delete_indent_draft(self.draft.id, actor, self.other_user)
