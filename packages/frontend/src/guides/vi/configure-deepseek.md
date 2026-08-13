# Mô-đun DeepSeek

## Tổng quan

Mô-đun **DeepSeek** dịch bằng API của DeepSeek. Mô-đun này cần một khóa API DeepSeek, được lưu trong kho bảo mật dưới khóa `DEEPSEEK_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **DeepSeek**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `DEEPSEEK_API_KEY`, dán khóa của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

Nếu sau này một thẻ hiển thị *Kho bảo mật đã khóa*, hãy bấm **Mở khóa kho bảo mật** trước khi dịch.

## Chọn mô hình

Trong tab **Cấu hình** của một dự án, chọn một mô hình DeepSeek (và mức độ suy luận tùy chọn), hoặc để nó kế thừa từ cấu hình chung. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun nào xử lý từng ngôn ngữ.

## Lấy khóa API DeepSeek

1. Truy cập [platform.deepseek.com](https://platform.deepseek.com).
2. Đăng ký hoặc đăng nhập.
3. Mở mục **API keys** của bạn.
4. Tạo một khóa API mới rồi sao chép.
5. Dán khóa vào giá trị của `DEEPSEEK_API_KEY` trong trình soạn kho bảo mật.
