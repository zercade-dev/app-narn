# Mô-đun OpenRouter

## Tổng quan

Mô-đun **OpenRouter** dịch bằng [OpenRouter](https://openrouter.ai) — một API duy nhất điều phối tới các mô hình từ nhiều nhà cung cấp (Anthropic, OpenAI, Google, Meta, và nhiều hãng khác). Mô-đun này cần một khóa API OpenRouter, được lưu trong kho bảo mật dưới khóa `OPENROUTER_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **OpenRouter**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `OPENROUTER_API_KEY`, dán khóa của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

Nếu sau này một thẻ hiển thị *Kho bảo mật đã khóa*, hãy bấm **Mở khóa kho bảo mật** trước khi dịch.

## Chọn mô hình

Trong tab **Cấu hình** của một dự án, chọn một mô hình từ danh mục OpenRouter trực tiếp — mỗi mục hiển thị giá theo token và độ dài ngữ cảnh của nó, và chỉ những mô hình sinh văn bản mới được liệt kê. Id mô hình có tiền tố nhà cung cấp (ví dụ `anthropic/claude-sonnet-4.5` hoặc `openai/gpt-4o-mini`); bạn cũng có thể gõ trực tiếp một slug mới. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun nào xử lý từng ngôn ngữ.

## Lấy khóa API OpenRouter

1. Truy cập [openrouter.ai](https://openrouter.ai).
2. Đăng ký hoặc đăng nhập.
3. Mở **Keys** từ menu tài khoản của bạn.
4. Tạo một khóa API mới rồi sao chép.
5. Dán khóa vào giá trị của `OPENROUTER_API_KEY` trong trình soạn kho bảo mật.

Lưu ý: văn bản của bạn được gửi tới OpenRouter và chuyển tiếp tới nhà cung cấp của mô hình bạn chọn, theo điều khoản của OpenRouter và chính sách dữ liệu của nhà cung cấp đó.
