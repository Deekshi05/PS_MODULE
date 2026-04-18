from __future__ import annotations

from rest_framework import serializers

from apps.psmodule.models import (
    Indent,
    IndentItem,
    Stock,
    StockEntry,
    StockEntryItem,
    StoreItem,
    TransferRequest,
)
from apps.psmodule.selectors import get_user_depadmin_role


class StoreItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreItem
        fields = ["id", "name", "unit"]


class IndentItemWriteSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    estimated_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )


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
            "delivery_confirmed",
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
            "delivery_confirmed",
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
    estimated_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    items = IndentItemWriteSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        item_ids = [i["item_id"] for i in items]
        if len(item_ids) != len(set(item_ids)):
            raise serializers.ValidationError("Duplicate item entries are not allowed.")
        return items


class HODActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT", "FORWARD"])
    notes = serializers.CharField(required=False, allow_blank=True)
    forward_to_department_code = serializers.CharField(required=False, allow_blank=True)


class StockEntryItemWriteSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class StockEntryCreateSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)
    items = StockEntryItemWriteSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one item is required.")
        item_ids = [i["item_id"] for i in items]
        if len(item_ids) != len(set(item_ids)):
            raise serializers.ValidationError("Duplicate item entries are not allowed.")
        return items


class PSAdminActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["BIDDING", "PURCHASE", "STOCK_ENTRY"])
    notes = serializers.CharField(required=False, allow_blank=True)


class StockEntryItemSerializer(serializers.ModelSerializer):
    item = StoreItemSerializer()

    class Meta:
        model = StockEntryItem
        fields = ["id", "item", "quantity"]


class StockEntrySerializer(serializers.ModelSerializer):
    items = StockEntryItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockEntry
        fields = ["id", "indent", "acting_role", "notes", "created_at", "items"]


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = ["id", "stock_name", "department", "quantity"]


class TransferRequestSerializer(serializers.ModelSerializer):
    stock = StockSerializer(read_only=True)
    requested_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = TransferRequest
        fields = [
            "id",
            "stock",
            "requested_by",
            "requested_from",
            "requested_quantity",
            "status",
            "created_at",
        ]


class TransferRequestCreateSerializer(serializers.Serializer):
    stock_id = serializers.IntegerField()
    requested_from = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    requested_quantity = serializers.IntegerField(default=1, min_value=1)

    def validate(self, attrs):
        request = self.context.get("request")
        role = get_user_depadmin_role(request.user) if request else None

        if not role:
            raise serializers.ValidationError({"detail": "Access Denied"})

        try:
            stock = Stock.objects.get(pk=attrs["stock_id"])
        except Stock.DoesNotExist:
            raise serializers.ValidationError({"stock_id": "Stock not found."})

        requested_from = attrs.get("requested_from", "")
        if not requested_from:
            requested_from = f"depadmin_{stock.department.replace('dep_', '')}"
            attrs["requested_from"] = requested_from

        if not isinstance(requested_from, str) or not requested_from.startswith(
            "depadmin_"
        ):
            raise serializers.ValidationError(
                {"requested_from": "Requested from must be a depadmin role."}
            )

        if requested_from == role:
            raise serializers.ValidationError(
                {"requested_from": "Cannot request from your own department."}
            )

        supplier_department = requested_from.replace("depadmin_", "dep_")
        if stock.department != supplier_department:
            raise serializers.ValidationError(
                {
                    "requested_from": "Requested from must match the stock owner's department.",
                }
            )

        requested_quantity = attrs.get("requested_quantity", 1)
        if requested_quantity < 1:
            raise serializers.ValidationError(
                {"requested_quantity": "Quantity must be at least 1."}
            )
        if requested_quantity > stock.quantity:
            raise serializers.ValidationError(
                {
                    "requested_quantity": "Requested quantity cannot exceed available stock quantity.",
                }
            )

        if stock.department == role.replace("depadmin_", "dep_"):
            raise serializers.ValidationError(
                {
                    "stock_id": "Cannot request transfer for stock already in your department.",
                }
            )

        return attrs
