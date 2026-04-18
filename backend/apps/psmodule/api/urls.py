from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.psmodule.api import views

router = DefaultRouter()
router.register(r"indents", views.IndentViewSet, basename="indent")
router.register(r"me", views.MeViewSet, basename="me")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "stock/check/<int:item_id>/", views.StockCheckView.as_view(), name="stock_check"
    ),
    path("stock/", views.StockListView.as_view(), name="stock_list"),
    path(
        "stock/available/",
        views.AvailableStockListView.as_view(),
        name="stock_available",
    ),
    path(
        "request/",
        views.TransferRequestListCreateView.as_view(),
        name="transfer_request_list_create",
    ),
    path(
        "requests/",
        views.TransferRequestListCreateView.as_view(),
        name="transfer_request_list_create_alias",
    ),
    path(
        "request/<int:pk>/approve/",
        views.TransferRequestApproveView.as_view(),
        name="transfer_request_approve",
    ),
    path(
        "request/<int:pk>/reject/",
        views.TransferRequestRejectView.as_view(),
        name="transfer_request_reject",
    ),
]
