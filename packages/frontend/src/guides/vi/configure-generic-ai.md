# Mô-đun Generic AI

## Tổng quan

Mô-đun **Generic AI** kết nối tới bất kỳ API tương thích OpenAI nào — một nhà cung cấp trên nền tảng đám mây hoặc một máy chủ chạy cục bộ (ví dụ Ollama, LM Studio, vLLM). Khóa của mô-đun được lưu trong kho bảo mật dưới `GENERIC_API_KEY`.

**Khóa API là tùy chọn.** Nó chỉ quan trọng với những điểm cuối cần xác thực (hầu hết các nhà cung cấp đám mây trả phí). Một máy chủ cục bộ như Ollama hay LM Studio không cần khóa thật — nhưng kho bảo mật vẫn yêu cầu trường `GENERIC_API_KEY` không được để trống, nên hãy lưu một giá trị giữ chỗ bất kỳ (ví dụ `local`) để thỏa điều kiện đó.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **Generic AI**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `GENERIC_API_KEY`, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**. Với một điểm cuối trả phí, hãy dán khóa API thật vào ô giá trị. Với một máy chủ cục bộ không cần xác thực, khóa là tùy chọn — chỉ cần lưu một giá trị giữ chỗ khác rỗng (ví dụ `local`).

## Chạy nhiều điểm cuối bằng các thực thể

Generic AI hỗ trợ **thực thể có tên riêng**, nên bạn có thể đăng ký nhiều điểm cuối cùng lúc (ví dụ một nhà cung cấp đám mây và một máy chủ cục bộ). Dùng **Thêm một thực thể Generic AI nữa…** ở Cấu hình chung. Mỗi thực thể có khóa kho bảo mật dẫn xuất riêng — ví dụ `GENERIC_API_KEY__MY-OLLAMA` — mà bạn điền trong cùng trình soạn kho bảo mật đó.

## Chọn điểm cuối và mô hình

Đặt URL gốc và mô hình cho mô-đun (hoặc từng thực thể) trong phần cài đặt Cấu hình chung của nó, rồi chọn mô hình theo từng dự án ở tab **Cấu hình**. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun hoặc thực thể nào xử lý từng ngôn ngữ.

## Lấy thông tin xác thực

Với một **máy chủ cục bộ** (Ollama, LM Studio, vLLM), không cần tài khoản hay khóa — chỉ cần URL gốc (ví dụ `http://localhost:11434/v1`) và một giá trị giữ chỗ ở trường `GENERIC_API_KEY`.

Với một **nhà cung cấp trả phí**, các bước tùy thuộc vào nhà cung cấp: tạo tài khoản, lấy URL gốc và khóa API, rồi xác nhận điểm cuối đó nói đúng định dạng chat-completions của OpenAI trước khi nhập khóa vào kho bảo mật.
