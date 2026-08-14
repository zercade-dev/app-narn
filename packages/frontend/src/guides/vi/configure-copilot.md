# Mô-đun GitHub Copilot

## Tổng quan

Mô-đun **Copilot** dịch qua GitHub Copilot. Mô-đun này xác thực bằng một token GitHub từ một tài khoản có **gói Copilot đang hoạt động**, được lưu trong kho bảo mật dưới khóa `GITHUB_TOKEN`.

## Thêm token của bạn vào kho bảo mật

Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa, không nằm trong tệp cấu hình dạng thô. Bạn mở khóa kho một lần cho mỗi phiên bằng mật khẩu.

1. Mở **Cấu hình chung** từ thanh bên.
2. Nếu bạn chưa thiết lập kho bảo mật, hãy tạo kho: chọn một mật khẩu kho (bạn sẽ dùng lại mật khẩu này ở mỗi phiên) rồi mở khóa.
3. Ở mục **Bật một mô-đun**, chọn **GitHub Copilot**. Khi thiếu một khóa bắt buộc, trình soạn kho bảo mật sẽ tự mở đúng khóa đó — nếu không, hãy bấm **Quản lý kho bảo mật**.
4. Trong trình soạn kho bảo mật, thêm một thông tin xác thực: chọn khóa `GITHUB_TOKEN`, dán token của bạn vào ô giá trị, nhập **mật khẩu kho bảo mật** của bạn, rồi bấm **Lưu**.

Nếu danh sách mô hình hiển thị *Không có mô hình nào khả dụng*, có thể token bị thiếu, không hợp lệ, hoặc kho bảo mật đang khóa — hãy mở khóa kho hoặc kiểm tra lại token GitHub của bạn, rồi mở lại thẻ đó.

## Lấy token GitHub

Dùng một token truy cập cá nhân dạng **fine-grained** để nó chỉ cấp quyền Copilot và không gì khác.

1. Truy cập [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Bấm **Generate new token** (token fine-grained là mặc định).
3. Đặt tên (ví dụ “Translator-Copilot”) và đặt **Expiration**.
4. Ở mục **Permissions → Account permissions**, tìm **Copilot Requests** và đặt thành **Read-only**. Không cần quyền nào khác.
5. Bấm **Generate token** rồi sao chép ngay — GitHub chỉ hiển thị token này một lần.
6. Dán token vào giá trị của `GITHUB_TOKEN` trong trình soạn kho bảo mật.

Tài khoản đứng sau token phải có gói Copilot đang hoạt động thì bản dịch mới thành công.
