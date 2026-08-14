# Rà soát AI

## Tổng quan

Ngoài các kiểm tra LQA tự động, ứng dụng có thể dùng một mô hình AI để rà soát nội dung của bạn. Có hai tab rà soát AI cộng với một hàng chờ duyệt thủ công. Mọi lượt rà soát AI đều cần một mô-đun LLM được bật ở **Cấu hình chung** và kho bảo mật đã mở khóa.

## Rà soát bản dịch bằng AI

Tab **Rà soát bản dịch bằng AI** cho AI **đánh giá** các bản dịch đã hoàn tất về **độ chính xác, độ trôi chảy, thuật ngữ và sắc thái**.

* Bấm **Rà soát lần chạy gần nhất** để đánh giá lần chạy dịch đã hoàn tất mới nhất (hoặc bắt đầu một lượt rà soát từ một lần chạy cụ thể ở tab **Hoạt động**).
* Lần lượt xem qua các kết quả bị gắn cờ; mỗi kết luận hiển thị văn bản nguồn, bản dịch, một **điểm số**, và thường có cả một **đề xuất**.
* **Áp dụng** một đề xuất để thay thế bản dịch, hoặc **Áp dụng mọi đề xuất** để áp dụng tất cả trong một lượt. Một cảnh báo sẽ xuất hiện nếu đề xuất đó làm mất thẻ, phần giữ chỗ hoặc ngắt dòng.

## Rà soát nguồn bằng AI

Tab **Rà soát nguồn bằng AI** kiểm tra **chính văn bản nguồn** — nó chỉ mang tính báo cáo và không bao giờ thay đổi bản dịch.

1. Chọn các kiểm tra cần chạy: **lỗi chính tả**, **ngữ pháp**, **thuật ngữ**, **độ rõ ràng**, và nội dung **không an toàn**.
2. Chọn **mô-đun** và **mô hình**, và tùy chọn **ngôn ngữ trả lời** cho các phát hiện.
3. Bấm **Bắt đầu rà soát**. Việc này chạy nền — theo dõi tiến độ ở tab **Hoạt động**.
4. Xem từng phát hiện và **Đồng ý** hoặc **Bỏ qua**; một bản viết lại nguồn được đề xuất có thể được sao chép.

## Duyệt thủ công

Tab **Duyệt thủ công** là một hàng chờ duyệt do con người thực hiện. Các bản dịch được đánh dấu **Cần duyệt** (hoặc **Đã gắn cờ**) xuất hiện ở đây, nơi bạn có thể **Chấp thuận**, **Sửa**, **Gắn cờ**, **Dịch lại**, hoặc yêu cầu một lượt **dịch ngược** về nguồn để làm tài liệu tham khảo. Phím tắt giúp thao tác nhanh hơn: `↑`/`↓` để di chuyển, `a` để chấp thuận, `e` để sửa.
