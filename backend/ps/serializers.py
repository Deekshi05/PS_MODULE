from __future__ import annotations

from rest_framework import serializers

from accounts.models import DepartmentInfo, ExtraInfo
from ps.models import Indent, IndentAudit, IndentItem, StoreItem
from ps.rbac import ActingRole, get_actor_context
from ps.services import check_stock, get_department_depadmin, get_department_hod


class StoreItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreItem
        fields = ["id", "name", "unit"]


class IndentItemWriteSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    estimated_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)


class IndentItemReadSerializer(serializers.ModelSerializer):
    item = StoreItemSerializer()

    class Meta:
        model = IndentItem
        fields = ["id", "item", "quantity", "estimated_cost"]


class IndentSerializer(serializers.ModelSerializer):
    items = IndentItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Indent
        fields = [
            "id",
            "purpose",
            "justification",
            "estimated_cost",
            "status",
            "stock_available",
            "procurement_type",
            "department",
            "current_approver",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = [
            "status",
            "stock_available",
            "procurement_type",
            "department",
            "current_approver",
            "created_at",
            "updated_at",
        ]


class IndentCreateSerializer(serializers.Serializer):
    purpose = serializers.CharField(max_length=255)
    justification = serializers.CharField(allow_blank=True, required=False)
    estimated_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    items = IndentItemWriteSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        item_ids = [i["item_id"] for i in items]
        if len(item_ids) != len(set(item_ids)):
            raise serializers.ValidationError("Duplicate item entries are not allowed.")
        existing = set(StoreItem.objects.filter(id__in=item_ids).values_list("id", flat=True))
        missing = [i for i in item_ids if i not in existing]
        if missing:
            raise serializers.ValidationError(f"Unknown item_ids: {missing}")
        return items

    def create(self, validated_data):
        request = self.context["request"]
        actor = get_actor_context(request)
        if actor.role != ActingRole.EMPLOYEE:
            raise serializers.ValidationError("Only employees can submit indents.")

        indenter: ExtraInfo = actor.extrainfo
        department: DepartmentInfo = indenter.department

        indent = Indent.objects.create(
            indenter=indenter,
            department=department,
            purpose=validated_data["purpose"],
            justification=validated_data.get("justification", ""),
            estimated_cost=validated_data.get("estimated_cost"),
            status=Indent.Status.SUBMITTED,
        )

        for line in validated_data["items"]:
            IndentItem.objects.create(
                indent=indent,
                item_id=line["item_id"],
                quantity=line["quantity"],
                estimated_cost=line.get("estimated_cost"),
            )

        indent.stock_available = check_stock(indent)

        # Routing hierarchy:
        # Employee -> Dept Head (HOD) -> DepAdmin (stock check + procurement)
        hod = get_department_hod(department)
        if hod:
            indent.current_approver = hod
        else:
            indent.current_approver = get_department_depadmin(department)
        indent.status = Indent.Status.SUBMITTED
        indent.save(update_fields=["stock_available", "current_approver", "status", "updated_at"])

        IndentAudit.objects.create(
            indent=indent,
            user=request.user,
            acting_role=actor.role,
            action="SUBMIT",
            notes="",
        )

        return indent


class HODActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT", "FORWARD"])
    notes = serializers.CharField(required=False, allow_blank=True)
    forward_to_department_code = serializers.CharField(required=False, allow_blank=True)

