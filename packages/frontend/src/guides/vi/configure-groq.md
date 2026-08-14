# Mô-đun Groq

## Tổng quan

Mô-đun **Groq** dịch bằng [Groq](https://groq.com) — suy luận nhanh cho các mô hình mở như Llama, Qwen và GPT-OSS, với gói miễn phí phù hợp cho công việc dịch thuật hằng ngày. Mô-đun này cần một khóa API Groq, được lưu trong kho bảo mật dưới khóa `GROQ_API_KEY`.

## Thêm khóa của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **Groq**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `GROQ_API_KEY`, dán khóa của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

Nếu sau này một thẻ hiển thị *Kho bảo mật đã khóa*, hãy bấm **Mở khóa kho bảo mật** trước khi dịch.

## Chọn mô hình

Trong tab **Cấu hình** của một dự án, chọn một mô hình từ danh mục Groq trực tiếp, hoặc kế thừa giá trị mặc định chung. `llama-3.3-70b-versatile` là lựa chọn mặc định vững chắc cho chất lượng dịch; các mô hình nhỏ hơn như `llama-3.1-8b-instant` đánh đổi một phần chất lượng để lấy tốc độ. **Quy tắc điều phối** ở tab Điều phối quyết định mô-đun nào xử lý từng ngôn ngữ.

## Lấy khóa API Groq

1. Truy cập [console.groq.com](https://console.groq.com).
2. Đăng ký hoặc đăng nhập.
3. Mở **API Keys** từ menu của bảng điều khiển.
4. Tạo một khóa API mới rồi sao chép — khóa bắt đầu bằng `gsk_`.
5. Dán khóa vào giá trị của `GROQ_API_KEY` trong trình soạn kho bảo mật.

Gói miễn phí của Groq áp dụng giới hạn hằng ngày theo từng mô hình (không nêu con số cố định ở đây — hãy kiểm tra bảng điều khiển của bạn để biết giới hạn hiện tại), và theo điều khoản của Groq, dữ liệu API không được dùng để huấn luyện mô hình. Sau khi khóa của bạn được thêm vào, **NARN Freeway** sẽ tự động bao gồm gói miễn phí của Groq khi phân bổ công việc dịch thuật trên hạn ngạch miễn phí của các nhà cung cấp bạn đã kết nối — không cần thiết lập gì thêm.
