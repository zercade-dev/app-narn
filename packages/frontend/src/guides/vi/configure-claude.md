# Mô-đun Anthropic (Claude)

## Tổng quan

Mô-đun **Claude** dịch bằng các mô hình Claude của Anthropic. Mô-đun này cần một khóa API Anthropic, được lưu trong kho bảo mật dưới khóa `ANTHROPIC_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **Anthropic (Claude)**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `ANTHROPIC_API_KEY`, dán khóa của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**. Việc lưu sẽ mã hóa lại kho.

Nếu sau này một thẻ hiển thị *Kho bảo mật đã khóa*, hãy bấm **Mở khóa kho bảo mật** trước khi dịch.

## Chọn mô hình

Trong tab **Cấu hình** của một dự án, chọn một mô hình Claude (và mức độ suy luận tùy chọn), hoặc để nó **kế thừa từ cấu hình chung**. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun nào xử lý từng ngôn ngữ.

## Lấy khóa API Anthropic

1. Truy cập [console.anthropic.com](https://console.anthropic.com).
2. Đăng ký hoặc đăng nhập.
3. Mở mục **API keys**.
4. Bấm **Create Key** rồi sao chép khóa.
5. Dán khóa vào giá trị của `ANTHROPIC_API_KEY` trong trình soạn kho bảo mật.
