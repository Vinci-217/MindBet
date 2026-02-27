package response

import (
	"net/http"

	"github.com/beego/beego/v2/server/web"
)

type JsonResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorInfo  `json:"error,omitempty"`
}

type ErrorInfo struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type PaginationData struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

func Success(ctx *web.Context, data interface{}) {
	ctx.Output.SetStatus(http.StatusOK)
	ctx.JSONResp(JsonResponse{
		Success: true,
		Data:    data,
	})
}

func SuccessWithPagination(ctx *web.Context, list interface{}, total int64, page, pageSize int) {
	ctx.Output.SetStatus(http.StatusOK)
	ctx.JSONResp(JsonResponse{
		Success: true,
		Data: PaginationData{
			List:     list,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
	})
}

func Error(ctx *web.Context, code int, message string) {
	statusCode := http.StatusBadRequest
	if code >= 500 {
		statusCode = http.StatusInternalServerError
	} else if code == 401 {
		statusCode = http.StatusUnauthorized
	} else if code == 403 {
		statusCode = http.StatusForbidden
	} else if code == 404 {
		statusCode = http.StatusNotFound
	}

	ctx.Output.SetStatus(statusCode)
	ctx.JSONResp(JsonResponse{
		Success: false,
		Error: &ErrorInfo{
			Code:    code,
			Message: message,
		},
	})
}

func BadRequest(ctx *web.Context, message string) {
	Error(ctx, 400, message)
}

func Unauthorized(ctx *web.Context, message string) {
	Error(ctx, 401, message)
}

func Forbidden(ctx *web.Context, message string) {
	Error(ctx, 403, message)
}

func NotFound(ctx *web.Context, message string) {
	Error(ctx, 404, message)
}

func InternalError(ctx *web.Context, message string) {
	Error(ctx, 500, message)
}
