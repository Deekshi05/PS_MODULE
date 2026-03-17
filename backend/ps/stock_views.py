from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from ps.models import CurrentStock, StoreItem


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

        item = StoreItem.objects.filter(id=item_id).first()
        if not item:
            raise ValidationError({"item_id": "Unknown item."})
        stock = CurrentStock.objects.filter(item=item).first()
        available = stock.quantity if stock else 0

        if available >= required_int:
            status = "AVAILABLE"
        elif available > 0:
            status = "PARTIAL"
        else:
            status = "NOT_AVAILABLE"

        return Response({"item_id": item.id, "item_name": item.name, "available": available, "required": required_int, "status": status})

