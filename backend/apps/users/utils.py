from rest_framework.views import exception_handler

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Instead of just {"detail": "..."} we want {"success": False, "error": "...", "message": "..."}
        detail = response.data.get('detail', str(exc))
        response.data = {
            "success": False,
            "error": response.data,
            "message": detail
        }

    return response
