# Pseudo Test

## Tổng quan

**Pseudo Test** không phải một ngôn ngữ thật. Đây là một ngôn ngữ kiểm thử chất lượng miễn phí, chạy ngoại tuyến, viết lại văn bản nguồn của bạn thành một phiên bản bị làm biến dạng có chủ đích, để bạn nạp nó vào trò chơi và xem chuỗi nào làm hỏng giao diện — trước khi có bất kỳ bản dịch thật nào.

Nó không tốn gì cả, không cần khóa API, và không bao giờ gửi bất cứ thứ gì tới một nhà cung cấp.

## Nó tạo ra gì

`Save changes` trở thành một thứ như `⟦Şàvé çhàñgéş~~~~⟧`. Ba việc đang xảy ra cùng lúc, và mỗi việc phơi bày một loại lỗi khác nhau:

* **Chữ cái có dấu.** Mỗi chữ cái được đổi thành một chữ giống nó nhưng có dấu phụ. Bất kỳ văn bản nào vẫn hiện ra là tiếng Anh thuần trong trò chơi của bạn thì chưa từng được đưa vào bảng chuỗi — nó bị gán cứng, và sẽ không người dịch nào chạm tới được.
* **Đệm thêm.** Văn bản được kéo dài bằng các ký tự `~` tới khoảng 1,4× độ dài gốc, mô phỏng những ngôn ngữ như tiếng Đức thường dài dòng. Nhãn bị tràn khỏi nút, xuống dòng xấu, hoặc đẩy lệch bố cục sẽ lộ ra ngay.
* **Dấu ngoặc.** Kết quả được bọc trong `⟦…⟧`. Nếu một trong hai dấu ngoặc bị thiếu trên màn hình, chuỗi đó đang bị cắt cụt.

Phần giữ chỗ và thẻ đánh dấu trong văn bản của bạn đi qua nguyên vẹn, nên nếu một trong số chúng bị làm biến dạng, đó là một lỗi đáng báo cáo chứ không phải vấn đề bố cục.

## Sử dụng

1. Ở tab **Dữ liệu**, tích **Pseudo Test** trong mục *Ngôn ngữ đích* rồi lưu.
2. Chạy một lượt dịch như bình thường. Các mục Pseudo Test luôn do bộ sinh pseudo có sẵn xử lý — không có gì cần bật, không cần viết quy tắc điều phối, và không tốn phí. Các nhà cung cấp trả phí của bạn không bao giờ thấy những chuỗi này.
3. Bản dịch thật của bạn vẫn an toàn: văn bản Pseudo Test được lưu trong cột riêng của nó và không bao giờ ghi đè lên một ngôn ngữ khác.

## Đưa nó vào trò chơi

Ở thẻ xuất, đặt **Xuất văn bản pseudo dưới dạng** thành một ngôn ngữ bạn hiện chưa phát hành — tiếng Đức chẳng hạn — rồi tải tệp xuống và nạp vào trò chơi với ngôn ngữ đó được chọn. Cột của ngôn ngữ đã chọn được điền bằng văn bản Pseudo Test chỉ cho lần tải xuống này; không có gì trong bộ nhớ bị thay đổi, và các bản dịch thật vẫn còn nguyên ở lần xuất kế tiếp.

Khi bạn kiểm thử xong, hãy xuất lại với phần thay thế đặt về **Không thay thế**. Một lần xuất bình thường không bao giờ chứa cột Pseudo Test — văn bản pseudo chỉ tới được trò chơi của bạn qua phần thay thế nói trên — nên việc để Pseudo Test bật không ảnh hưởng tới các tệp bạn phát hành.

## Khi nào nên dùng

Chạy một lượt pseudo sớm, trước khi bạn đặt bất kỳ bản dịch nào. Mỗi lỗi bố cục nó tìm ra là một lỗi bạn sửa một lần, thay vì mười lăm lần sau khi mười lăm ngôn ngữ đã về.
