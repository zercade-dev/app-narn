# Bộ nhớ dịch

## Tổng quan

**Bộ nhớ dịch** (TM) là một kho lưu trữ các bản dịch đã biết, dùng chung cho cả không gian làm việc. Khi văn bản nguồn của một chuỗi khớp với một chuỗi đã có trong bộ nhớ, bản dịch đã lưu được dùng lại tự động thay vì gọi một mô-đun trả phí — tiết kiệm thời gian, chi phí, và giữ văn bản giống hệt nhau nhất quán giữa các dự án. Mở khung nhìn **Bộ nhớ dịch** từ thanh bên để duyệt và tìm kiếm các đoạn đã lưu.

> **Bộ nhớ dịch bị tắt theo mặc định** cho mọi dự án. Khi nó đang tắt, không có gì một dự án dịch được ghi vào bộ nhớ và không có bản dịch đã lưu nào được tự động áp dụng. Để bật, mở tab **Cấu hình** của dự án và chọn một chính sách dùng lại trong mục **Bộ nhớ dịch** (bất kỳ giá trị nào khác *Tắt*).

## Cách các mục vào được bộ nhớ

* **Chấp thuận vào bộ nhớ** — ở tab **Bản dịch**, chọn các bản dịch rồi chấp thuận; chúng được ghi lại như các đoạn đáng tin cậy.
* Các bản dịch đã hoàn tất cũng được ghi lại để văn bản nguồn giống hệt có thể dùng lại chúng sau này.

## Chính sách dùng lại

Chính sách dùng lại (ở tab **Cấu hình** của dự án, mục **Bộ nhớ dịch**) quyết định *liệu* và *khi nào* một bản dịch đã lưu được dùng lại cho văn bản nguồn giống hệt. Mặc định là **Tắt** (TM tắt); các lựa chọn khác — ví dụ **Chặt (khớp trọn bối cảnh)**, chỉ dùng lại khi cả bối cảnh xung quanh cũng khớp — sẽ bật nó lên. Siết chặt chính sách giúp tránh dùng lại một bản dịch từng đúng ở chỗ này nhưng không đúng ở chỗ khác.

## Kiểm soát việc dùng lại theo từng lần chạy

Khi bạn bắt đầu một lượt dịch từ hộp thoại *Dịch…* của tab **So sánh**, một thông báo cho biết bao nhiêu mục sẽ được điền từ bộ nhớ, và bạn có thể **tắt bộ nhớ dịch cho lần chạy này** để buộc mọi mục được dịch mới hoàn toàn — hữu ích khi bạn muốn mô hình xem xét lại văn bản đã được ghi nhớ trước đó.
