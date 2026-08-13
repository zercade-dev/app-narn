# Kho bảo mật

## Tổng quan

Khóa API của nhà cung cấp không bao giờ được giữ trong tệp cấu hình thô hay biến môi trường. Chúng nằm trong **kho bảo mật** — một kho lưu trữ đã mã hóa phải được mở khóa trước khi bất kỳ lượt dịch hay rà soát AI nào có thể dùng một thông tin xác thực. Bạn mở khóa một lần cho mỗi phiên trình duyệt; thông tin xác thực chỉ được giải mã trong bộ nhớ.

<!-- local-only -->
## Kho mật khẩu (tự lưu trữ)

Trên một bản cài đặt tự lưu trữ, kho bảo mật là một tệp cục bộ đã mã hóa. Lần mở khóa đầu tiên sẽ tạo ra nó: mật khẩu bạn chọn trở thành mật khẩu kho, và mỗi thông tin xác thực bạn lưu sẽ mã hóa lại tệp đó. Bản thân mật khẩu không bao giờ được lưu trữ — không có nó, tệp không thể giải mã được. Mở khóa từ **Cấu hình chung**, hoặc từ bất kỳ thẻ *Kho bảo mật đã khóa* nào.
<!-- /local-only -->

## Kho gắn với thiết bị (đám mây)

Trên phiên bản đám mây, kho bảo mật được lưu **đã mã hóa trên máy chủ**, và việc giải mã nó cần hai yếu tố:

- **Mật khẩu** của bạn — không bao giờ được lưu ở bất cứ đâu, kể cả trên máy chủ hay thiết bị.
- Một **khóa riêng theo thiết bị** — được tạo trong trình duyệt của bạn khi bạn đăng ký một thiết bị và chỉ được giữ trên thiết bị đó.

Khi bạn mở khóa, cả hai yếu tố đi qua kết nối đã mã hóa và được kết hợp ở phía máy chủ để suy ra khóa giải mã **chỉ trong bộ nhớ, chỉ cho phiên của bạn**. Không yếu tố nào, cũng không khóa suy ra được, từng được ghi vào bộ lưu trữ của máy chủ — thứ được lưu chỉ là chính kho bảo mật đã mã hóa. Vì vậy, chỉ riêng dữ liệu lưu trên máy chủ không thể tiết lộ thông tin xác thực của bạn, và chỉ riêng một mật khẩu bị lộ cũng không đủ: việc mở khóa còn cần một trong các thiết bị đã đăng ký của bạn.

Nếu Cấu hình chung hiển thị một nút **Tới trang kho bảo mật** thay vì ô nhập mật khẩu, bạn đang dùng kho gắn với thiết bị — trang Kho bảo mật xử lý việc thiết lập, đăng ký thiết bị, mở khóa, sửa thông tin xác thực, và đổi mật khẩu.

## Điều cần biết

- Một thiết bị bạn chưa từng dùng phải được **đăng ký** ở trang Kho bảo mật trước khi nó có thể mở khóa.
- Nếu bạn mất mật khẩu (hoặc, trên đám mây, mất mọi thiết bị đã đăng ký), nội dung kho bảo mật không thể khôi phục được — bạn sẽ phải thiết lập lại kho và nhập lại khóa của các nhà cung cấp.
- Mọi thứ ứng dụng ghi log đều đi qua việc ẩn thông tin nhạy cảm, nên giá trị thông tin xác thực không bao giờ xuất hiện trong log.
