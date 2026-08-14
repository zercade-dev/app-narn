# Tab Hoạt động

## Tổng quan

Tab **Hoạt động** là trung tâm điều khiển cho các tác vụ chạy nền. Mọi tác vụ chạy dài đều xuất hiện ở đây: các lần chạy **dịch**, **rà soát AI** (bản dịch và nguồn), **sinh bảng thuật ngữ**, và **sinh danh mục**. Các lần chạy được xếp hàng và chạy tuần tự theo từng dự án, nên bạn có thể xếp nhiều lần chạy rồi xem chúng lần lượt hoàn tất.

## Đọc một lần chạy

Mỗi lần chạy hiển thị **loại**, **trạng thái** (Đang xếp hàng, Đang chạy, Đã tạm dừng, Đã xong, Thất bại, hoặc Đã hủy), tiến độ, và một **chi phí** ước tính. Chi phí là số ước tính do mô-đun báo về, tính từ giá mỗi triệu token của từng mô hình, nên các mô hình biết suy nghĩ có thể báo tổng số token lớn so với số ký tự. Dùng **Xem chi tiết** để xem chính xác những gì một lần chạy đã dịch, các lần thử lại, và mức dùng ký tự/token. Bạn có thể sao chép id của một lần chạy để tham khảo.

## Quản lý hàng đợi

* **Tạm dừng** / **Tiếp tục** một lần chạy, hoặc **Chạy ngay** để đưa một lần chạy đang xếp hàng lên trước.
* **Đưa lên trong hàng đợi** / **Đưa xuống trong hàng đợi** để sắp xếp lại hàng đợi.
* **Hủy** một lần chạy đang xếp hàng hoặc đang chạy.

## Khôi phục và rà soát

* Nếu một số chuỗi thất bại, **Thử lại các mục lỗi** sẽ chạy lại đúng những chuỗi đó.
* Với một lần chạy dịch đã hoàn tất, hãy bắt đầu một lượt **rà soát AI** ngay từ lần chạy đó — chọn mô-đun và mô hình (mặc định là mô-đun và mô hình đã dùng để dịch), rồi mở các kết luận ở tab **Rà soát bản dịch bằng AI**.
