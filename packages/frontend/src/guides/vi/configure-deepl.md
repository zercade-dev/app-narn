# Mô-đun DeepL

## Tổng quan

Mô-đun **DeepL** cung cấp dịch máy nơ-ron chuyên nghiệp. Khác với các mô-đun LLM, đây là MT cổ điển, và nó có thể đẩy các bảng thuật ngữ của dự án lên DeepL để giữ thuật ngữ nhất quán. Khóa của mô-đun được lưu trong kho bảo mật dưới `DEEPL_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **DeepL**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `DEEPL_API_KEY`, dán khóa xác thực của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

DeepL không hỗ trợ thực thể có tên riêng — chỉ có một mô-đun DeepL duy nhất.

## Dùng bảng thuật ngữ

DeepL có thể áp dụng một bảng thuật ngữ trong lúc dịch. Xây dựng thuật ngữ ở tab **Bảng thuật ngữ**, rồi dùng **Đẩy lên DeepL** để tải chúng lên. Nếu một bảng thuật ngữ thay đổi sau khi đã đẩy, tab sẽ hiển thị *Cần đẩy lại* — hãy đẩy lại để cập nhật DeepL.

## Lấy khóa API DeepL

1. Truy cập [deepl.com/account](https://www.deepl.com/account).
2. Đăng ký tài khoản API Free hoặc Pro.
3. Mở **Account Settings** và tìm mục **API Key**.
4. Sao chép khóa xác thực của bạn.
5. Dán khóa vào giá trị của `DEEPL_API_KEY` trong trình soạn kho bảo mật.
