from django.db import transaction
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from department_stock.models import Stock, TransferLog, TransferRequest
from department_stock.permissions import (
    get_user_depadmin_role,
    get_user_ps_admin_role,
    require_depadmin_role,
)
from department_stock.serializers import (
    StockSerializer,
    TransferRequestCreateSerializer,
    TransferRequestSerializer,
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
            requests = TransferRequest.objects.filter(status=TransferRequest.Status.APPROVED)
        else:
            requests = TransferRequest.objects.filter(requested_by=request.user)
            requests = requests | TransferRequest.objects.filter(requested_from=depadmin_role)

        requests = requests.select_related("stock", "requested_by").order_by("-created_at").distinct()
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
        if not isinstance(requested_by_role, str) or not requested_by_role.startswith("depadmin_"):
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
