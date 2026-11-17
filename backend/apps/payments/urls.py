from django.urls import path
from . import views as v
urlpatterns = [
    path("payments/initialize/", v.InitializeOrderPayment.as_view()),
    path("payments/verify/", v.VerifyPayment.as_view()),
    path("payments/webhook/paystack/", v.PaystackWebhook.as_view()),
    path("payments/webhook/flutterwave/", v.FlutterwaveWebhook.as_view()),
    path("payments/bank-transfer/", v.BankTransferSubmit.as_view()),
    path("payments/", v.PaymentList.as_view()),
    path("payments/<int:pk>/verify-transfer/", v.VerifyTransfer.as_view()),
    path("payments/<int:pk>/proof/", v.ProofDownload.as_view()),
    path("payments/cod/reconciliation/", v.CODReconciliation.as_view()),
    path("payments/cod/<str:number>/collect/", v.CODCollect.as_view()),
    path("wallet/", v.WalletView.as_view()),
    path("wallet/fund/", v.WalletFund.as_view()),
]
