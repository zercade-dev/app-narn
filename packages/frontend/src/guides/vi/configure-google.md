# Mô-đun Google AI (Gemini)

## Tổng quan

Mô-đun **Google AI** dịch bằng các mô hình Gemini của Google. Mô-đun này cần một khóa API Google AI Studio, được lưu trong kho bảo mật dưới khóa `GOOGLE_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **Google AI (Gemini)**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `GOOGLE_API_KEY`, dán khóa của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

Nếu sau này một thẻ hiển thị *Kho bảo mật đã khóa*, hãy bấm **Mở khóa kho bảo mật** trước khi dịch.

## Chọn mô hình

Trong tab **Cấu hình** của một dự án, chọn một mô hình Gemini (và mức độ suy luận tùy chọn), hoặc để nó kế thừa từ cấu hình chung. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun nào xử lý từng ngôn ngữ. Các mô hình biết suy nghĩ báo tổng số token lớn so với số ký tự, nên chi phí ước tính có thể trông cao.

## Lấy khóa API Google

1. Truy cập [ai.google.dev](https://ai.google.dev) rồi bấm **Get API key**, hoặc vào thẳng [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Bấm **Create API key** và chọn dự án của bạn.
3. Sao chép khóa vừa được tạo.
4. Dán khóa vào giá trị của `GOOGLE_API_KEY` trong trình soạn kho bảo mật.
