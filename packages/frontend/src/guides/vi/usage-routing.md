# Tab Điều phối

## Tổng quan

Tab **Điều phối** quyết định mô-đun và mô hình nào xử lý từng mục. Nó mở ra với một bộ chọn nhà cung cấp duy nhất: chọn một nhà cung cấp và mọi mục trong dự án sẽ tới đó. Đó là tất cả những gì phần lớn dự án cần.

Cần nhiều hơn một đích đến? Chuyển tab sang **Nâng cao** và trình soạn quy tắc đầy đủ sẽ xuất hiện, nơi điều phối có thể khác nhau theo ngôn ngữ đích, danh mục, hoặc độ dài mục, và nơi bạn có thể giữ nhiều **nhóm quy tắc** có tên riêng. Tab này nhớ bạn đã dùng chế độ nào gần nhất. Một dự án có cách điều phối phức tạp hơn một nhà cung cấp luôn hiển thị trình soạn, bất kể bạn chọn chế độ nào — một thiết lập đã có không bao giờ bị ẩn khỏi bạn.

Dù theo cách nào, tab này chỉ quyết định *cách* các mục được gửi đi. Bản dịch được bắt đầu từ tab **Bản dịch** hoặc **So sánh**.

## Quy tắc điều phối

Các quy tắc nằm ở khung nhìn **Nâng cao**. Chúng được đánh giá theo thứ tự ưu tiên; quy tắc đầu tiên khớp với một mục sẽ thắng. Mỗi quy tắc có thể khớp theo:

* **Nguồn** — nhãn nguồn/xuất xứ của các mục đã nhập.
* **Giới hạn độ dài mục** — chỉ áp dụng cho các mục có số ký tự bằng hoặc dưới một mức nhất định.
* **Ngôn ngữ đích** và **danh mục**.

Với các mục khớp, quy tắc đặt **mô-đun** (và tùy chọn ghi đè **mô hình** và **mức độ suy luận**) cùng các gợi ý lời nhắc tùy chọn (nhân vật, sắc thái, giới tính, ghi chú). Thêm quy tắc bằng **Thêm quy tắc**; mọi thay đổi được lưu lại cho bạn ngay khi bạn thực hiện, nên không có nút **Lưu** nào cần nhớ. Bạn có thể giữ nhiều **nhóm quy tắc** có tên và chuyển đổi giữa chúng (việc chuyển đổi bị khóa trong lúc một lần chạy đang diễn ra).

## Cách nhóm lô

Tab Điều phối cũng có một điều khiển **Cách nhóm lô** — cùng mặc định theo từng dự án được hiển thị ở tab Cấu hình, kèm công tắc **Bỏ qua giới hạn cỡ lô** tương ứng. Nó giữ các mục liên quan trong cùng một yêu cầu tới nhà cung cấp, xuyên suốt các lần chạy dịch, đánh giá, và rà soát nguồn.

## Bắt đầu một lượt dịch

1. Chọn các mục ở tab **Bản dịch** hoặc **So sánh**.
2. Mở hộp thoại **Dịch…** từ đó — nó cung cấp các tùy chọn dịch lại, bộ nhớ, và cách nhóm theo từng lần chạy, rồi bắt đầu lần chạy.
3. Theo dõi tiến độ, các lần thử lại, và lỗi ở tab **Hoạt động**.
