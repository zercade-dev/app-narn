# Tab Sao lưu

## Tổng quan

Tab **Sao lưu** đóng gói một dự án — cấu hình, các mục và bảng thuật ngữ của nó — thành một tệp `.zip` kiểm chứng được. Mọi tệp đều có checksum, và các checksum được xác minh trước khi bất kỳ dữ liệu nào được ghi lại lúc khôi phục.

## Tạo bản sao lưu

1. Chọn một dự án.
2. Mở tab **Sao lưu**.
3. Bấm **Tạo bản sao lưu**.
4. Bản lưu mới xuất hiện trong **Bản sao lưu đã lưu**, nơi bạn có thể **Tải xuống**.

## Sao lưu tự động

Ứng dụng cũng tự tạo các bản chụp an toàn cho bạn, được liệt kê cùng các bản sao lưu thủ công:

* **Trước khi nhập CSV** — một điểm khôi phục ngay trước lần nhập.
* **Trước khi dịch lại** — một điểm khôi phục ngay trước khi các mục bị ghi đè.

Cấu hình chung có mục **Số bản sao lưu tối đa mỗi dự án** (mặc định 10); các bản cũ hơn mức đó sẽ bị dọn bớt.

## Khôi phục

1. Ở **Khôi phục từ bản sao lưu**, chọn một tệp `.zip` (hoặc chọn một trong các bản sao lưu đã lưu).
2. Ứng dụng xác minh checksum và hiển thị bản xem trước (dự án, tệp, thời điểm tạo).
3. Xác nhận. Việc khôi phục sẽ ghi đè lên cấu hình, các mục và bảng thuật ngữ hiện tại của dự án — không thể hoàn tác, nên hãy tạo một bản sao lưu mới trước nếu bạn còn phân vân.

## Xóa

Dùng **Xóa** trên bất kỳ bản sao lưu đã lưu nào để gỡ vĩnh viễn tệp đó khỏi máy chủ.
