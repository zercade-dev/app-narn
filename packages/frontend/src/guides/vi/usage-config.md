# Tab Cấu hình

## Tổng quan

Tab **Cấu hình** chứa chính sách dịch cho dự án đang chọn: lựa chọn mô hình theo từng mô-đun, dùng lại bộ nhớ dịch, cách nhóm lô, các kiểm tra chất lượng (LQA), và quản lý dự án. **Ngôn ngữ** và **nhập/xuất CSV** của nó giờ nằm ở tab **Dữ liệu** riêng. Thông tin xác thực của nhà cung cấp không được đặt ở đây — chúng nằm trong **kho bảo mật** (xem các hướng dẫn *Cấu hình mô-đun* và **Cấu hình chung**).

## Ngôn ngữ (ở tab Dữ liệu)

Đặt **ngôn ngữ nguồn** và các **ngôn ngữ đích** cần dịch tới ở tab **Dữ liệu**. Tập hợp ngôn ngữ đích đang dùng chi phối mọi tab khác — các cột mục, quy tắc điều phối, và các kiểm tra chất lượng đều theo nó.

## Nhập và xuất CSV (ở tab Dữ liệu)

Việc nhập và xuất CSV cũng nằm ở tab **Dữ liệu**:

* **Nhập CSV** nạp các mục nguồn và mọi bản dịch sẵn có. Một bản chụp an toàn được tạo tự động ngay trước mỗi lần nhập, nên bạn có thể khôi phục lại từ tab **Sao lưu**.
* Những hàng không thể phân tích gọn gàng (một dấu nháy đứng ngay trước dấu phẩy) sẽ bị loại và được báo cáo, thay vì được ghi thành dữ liệu lệch cột.
* **Xuất CSV** tải dự án xuống; bạn có thể chọn ngôn ngữ và có kèm cột bối cảnh cho người dịch hay không.
* Bản xuất ghi văn bản đúng như đã lưu, không thêm dấu nháy đơn trước các ô bắt đầu bằng = + - hoặc @. Chỉ bật **Bảo vệ cho bảng tính** với tệp bạn sẽ mở trong bảng tính, vì trình chỉnh sửa Miliastra giữ dấu nháy đó như văn bản. Các lượt dịch bỏ qua những hàng có giá trị Need translation? là FALSE. Không được nhập lại hoặc gửi tệp script máy khách đã bảo vệ tới trình chỉnh sửa.

### Tệp tập lệnh máy khách

CSV có cột **Text Mapping ID** là tệp tập lệnh máy khách. Tệp này được nhập vào bộ sưu tập riêng, **Văn bản tập lệnh máy khách**, tách biệt với **Văn bản chính** của bạn — bảng nhập cho biết đã phát hiện loại nào.

* Mỗi chuỗi máy khách được nhận diện bằng Text Mapping ID, nên cùng một nội dung tiếng Anh có thể xuất hiện ở cả hai bộ sưu tập và trên nhiều hàng máy khách mà không bị gộp lại.
* Nhập tệp máy khách không bao giờ thay đổi văn bản chính, và nhập tệp chính không bao giờ thay đổi văn bản máy khách.
* Khi tiếng Anh của một khóa hiện có thay đổi, ở cả hai chế độ nhập, hàng cũ chuyển sang tab **Mục mồ côi** và hàng mới giữ các bản dịch từ tệp; chỉ những ô trống mới chưa được dịch. Dùng **Liên kết lại** để chuyển bản dịch: hàng có cùng khóa được gợi ý trước, và chế độ ghi đè quyết định giữ hay thay thế các ô đã có nội dung.
* Khi dự án có chuỗi máy khách, **Xuất CSV** cho phép chọn bộ sưu tập cần tải xuống, và bản xuất máy khách giữ nguyên cột Text Mapping ID.

## Mô-đun và mô hình

Bật các nhà cung cấp một lần ở **Cấu hình chung**. Ở đây, trong Cấu hình, bạn chọn, theo từng dự án, **mô hình** và **mức độ suy luận** cho mỗi mô-đun đã bật — hoặc để nguyên ở *Kế thừa từ cấu hình chung*. Mô-đun nào thực sự chạy cho một mục nhất định do **quy tắc điều phối** quyết định (xem hướng dẫn *Tab Điều phối*).

## Kiểm tra LQA

Bảng **Kiểm tra LQA** cấu hình cổng chất lượng chạy trên mọi bản dịch: bật/tắt từng kiểm tra (trùng khớp thẻ, giới hạn độ dài, tràn, tuân thủ bảng thuật ngữ, thuật ngữ bị cấm, khẳng định regex, và nhiều hơn nữa) và đặt mỗi kiểm tra thành **Chặn** hoặc **Cảnh báo**. Vấn đề ở mức chặn khiến cổng chất lượng không đạt và có thể kích hoạt một lần thử lại tự động; cảnh báo chỉ được báo lại.

## Cách nhóm lô

**Cách nhóm lô** giữ các mục liên quan (theo danh mục và/hoặc bảng thuật ngữ) trong cùng một yêu cầu, để mô hình nhìn thấy chúng trong ngữ cảnh. Bạn có thể đặt một mặc định cho dự án và ghi đè theo từng lần chạy.

## Quản lý dự án

**Vùng nguy hiểm** cho phép bạn **Nhân bản** dự án (cấu hình và các mục, không bao giờ gồm bí mật) hoặc **Xóa** dự án vĩnh viễn.
