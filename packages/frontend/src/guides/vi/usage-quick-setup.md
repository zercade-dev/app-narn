# Thiết lập nhanh

## Tổng quan

Lần đầu dùng NARN? Lộ trình ngắn dưới đây đưa bạn từ con số không đến một bản dịch đã xuất chỉ trong năm bước. Thiết lập có hướng dẫn trong ứng dụng đi cùng bạn qua đúng các bước này; bạn có thể bỏ qua rồi tiếp tục sau — **Tiếp tục thiết lập** ở thanh bên sẽ quay lại chỗ bạn dừng, và bạn có thể bắt đầu lại từ Hướng dẫn này. Mọi thứ sau lộ trình ngắn dành cho lúc bạn muốn kiểm soát nhiều hơn.

## Lộ trình ngắn

1. **Tạo mật khẩu cho kho bảo mật.** Khóa nhà cung cấp của bạn được mã hóa bằng mật khẩu này — xem hướng dẫn [Kho bảo mật](guide:usage-vault). Ở phiên bản đám mây, bước 1 và 2 được làm cùng nhau trên trang kho bảo mật.
2. **Thêm một khóa miễn phí.** Khóa Google AI là cách bắt đầu dễ nhất — lấy tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey), hoặc chọn **Dùng nhà cung cấp của riêng tôi**. Sau đó [NARN Freeway](guide:usage-freeway) chọn các mô hình miễn phí cho bạn.
3. **Tạo dự án và nhập văn bản.** Tạo một dự án, rồi ở tab **Dữ liệu** chọn ngôn ngữ nguồn và các ngôn ngữ cần dịch sang, và dùng **Nhập CSV**.
4. **Dịch.** Trong **Bản dịch**, chọn tất cả các mục rồi bấm **Dịch**. NARN Freeway chọn các mô hình miễn phí cho bạn; theo dõi tiến độ ở **Hoạt động**.
5. **Xuất.** Tải tệp đã dịch xuống từ dự án.

Người dùng mới bắt đầu ở **chế độ Đơn giản**, chỉ hiện Cấu hình, Dữ liệu, Bản dịch và Hoạt động (cùng Hướng dẫn, Cài đặt và **Khóa nhà cung cấp**). Bạn có thể chuyển giữa **Đơn giản** và **Nâng cao** bất cứ lúc nào từ thanh trên cùng hoặc trong Cài đặt.

## Khi bạn muốn nhiều hơn

Các bước này nằm trong **chế độ Nâng cao** và giúp nâng chất lượng hoặc cho bạn kiểm soát chi tiết hơn. Các bước đánh dấu *(Optional)* không cần cho bản dịch đầu tiên — hãy bỏ qua và quay lại sau. Lần đầu bạn mở Điều phối, Bảng thuật ngữ, Chất lượng, So sánh hoặc Rà soát bản dịch bằng AI ở chế độ Nâng cao, một chuyến tham quan ngắn sẽ được đề nghị; bạn có thể bắt đầu lại bất kỳ chuyến nào từ Hướng dẫn này, hoặc tắt các đề nghị trong Cài đặt.

## Thêm nhà cung cấp và thông tin xác thực

1. Mở **Cấu hình chung** và **bật một mô-đun** cho mỗi nhà cung cấp bạn muốn dùng (Anthropic, OpenAI, DeepL, v.v.) từ danh sách **Bật một mô-đun** — DeepL được liệt kê theo tên, còn các nhà cung cấp AI xuất hiện dưới dạng **Thêm một thực thể … nữa…**, thao tác này tạo thực thể đầu tiên của nhà cung cấp. Một mô-đun có thể có nhiều **thực thể có tên riêng** — hữu ích khi bạn cần hai cấu hình của cùng một nhà cung cấp với khóa hoặc mặc định khác nhau.
2. Thông tin xác thực của nhà cung cấp được lưu trong **kho bảo mật** đã mã hóa — thiết lập ở lần dùng đầu tiên và mở khóa một lần mỗi phiên. Xem hướng dẫn *Kho bảo mật* để biết cách nó hoạt động.
3. Chọn một **mô hình** (và **mức độ suy luận** tùy chọn) cho mỗi mô-đun hoặc thực thể. Mô hình rẻ hơn dịch kém hơn, nên hãy chuẩn bị tinh thần thử-sai để tìm điểm cân bằng của bạn. Chú ý **mức độ suy luận** — ở các mô hình biết suy nghĩ, nó có thể nhân chi phí lên nhanh chóng.

## *(Optional)* Rà soát văn bản nguồn của bạn trước

Chạy **Rà soát nguồn bằng AI** trên ngôn ngữ nguồn trước khi dịch — sửa lỗi chính tả và cách diễn đạt chưa rõ ở đây sẽ có lợi cho mọi bản dịch thực hiện sau đó. Nếu một bản sửa làm thay đổi một mục đã có bản dịch, các bản dịch cũ sẽ rơi vào tab **Mục mồ côi** — hãy **liên kết lại** chúng, kèm tùy chọn dịch lại.

## *(Optional)* Bật bảng thuật ngữ

Ở tab **Bảng thuật ngữ**, bật những bảng thuật ngữ áp dụng cho dự án của bạn. Tự động áp dụng khớp thuật ngữ theo **trọn từ, không phân biệt hoa thường** — các dạng biến cách (số nhiều, chia động từ) sẽ không được bắt. Đang dịch bằng **DeepL**? Hãy đẩy bảng thuật ngữ lên đó bằng **Đẩy lên DeepL** (góc trên bên phải), và đẩy lại sau khi sửa.

## Thiết lập điều phối

Mở tab **Điều phối** và chọn nhà cung cấp của bạn từ bộ chọn mà nó mở sẵn — thao tác đó gửi mọi mục trong dự án tới nhà cung cấp đó, và đó là tất cả những gì một thiết lập một-nhà-cung-cấp cần. Muốn nhà cung cấp khác nhau theo từng ngôn ngữ, danh mục, hoặc độ dài mục? Chuyển sang **Nâng cao** và thêm **quy tắc điều phối** ở đó thay vào đó. Lựa chọn của bạn được lưu lại dù theo cách nào. Một dự án hoàn toàn không có quy tắc sẽ gửi mọi thứ qua NARN Freeway, nên ban đầu bước này là tùy chọn. Khi dự án đã có quy tắc, một mục không khớp quy tắc nào sẽ dịch thất bại với lỗi *"no route"*.

## *(Optional)* Xây dựng bảng thuật ngữ từ nội dung của chính bạn

Phát triển bảng thuật ngữ trước khi dịch hàng loạt: thêm thuật ngữ thủ công, chạy **Sinh bảng thuật ngữ** trên toàn bộ nguồn, hoặc — có mục tiêu hơn — chọn các mục ứng viên tốt ở tab **Bản dịch** và dùng **Sinh bảng thuật ngữ từ phần đã chọn** (kèm bản dịch sẵn có). Hãy dùng một mô hình đủ mạnh ở đây; chất lượng bảng thuật ngữ sẽ tác động dồn tích lên mọi thứ được dịch sau đó.

## *(Optional)* Tinh chỉnh chất lượng ở Compare trước

Trước một lượt dịch đầy đủ, dùng tab **So sánh** để chăm chút một ngôn ngữ mà bạn có thể tự đánh giá:

- Tinh chỉnh **bối cảnh** (nhân vật, sắc thái, ghi chú) và bảng thuật ngữ của từng mục cho tới khi bản dịch đọc đúng ý. Bối cảnh được lưu theo từng mục, không theo từng ngôn ngữ, nên công sức này tự động áp dụng cho mọi ngôn ngữ khác.
- Vì bạn đang tinh chỉnh từng mục một, một mô hình rẻ hoặc miễn phí là đủ dùng ở đây — ví dụ một khóa Gemini miễn phí (xem hướng dẫn *Google AI (Gemini)*), thêm vào như một **thực thể mô-đun** riêng với điều phối trỏ tạm thời tới nó. Gói miễn phí có hạn mức hằng ngày, nên hãy ưu tiên gộp yêu cầu.
- Hài lòng với kết quả? Hãy dịch trọn lô một lần với cùng cài đặt để xác nhận nó vẫn ổn khi dịch hàng loạt.

## Dịch hàng loạt

Có hai cách để chạy bản dịch thật:

- **Bản dịch** — chọn các mục và **Dịch mục đã chọn** để bao phủ mọi ngôn ngữ đích cùng lúc.
- **So sánh** — từng ngôn ngữ một, tùy chọn dùng một ngôn ngữ đã rà soát làm bối cảnh **tham chiếu**.

Với một dự án đầy đủ, dịch từng ngôn ngữ một kèm một ngôn ngữ tham chiếu đã rà soát thường là lựa chọn tốt nhất: lượt rà soát AI sau đó chỉ cần tập trung vào một ngôn ngữ. Theo dõi tiến độ ở tab **Hoạt động**.

Việc chia lô là tự động theo mặc định; với một dự án nhỏ có nhiều mục ngắn, một cỡ lô tùy chỉnh là **0** (cả ngôn ngữ trong một yêu cầu) có thể hiệu quả hơn với một mô hình đủ mạnh.

## Rà soát lần chạy

Chọn một trong các cách sau:

- Kích hoạt một lượt **rà soát AI** cho lần chạy đã hoàn tất từ tab **Hoạt động**.
- Rà soát thủ công ở **Duyệt thủ công** hoặc **So sánh**.
- Chấp thuận mọi thứ như hiện trạng và rà soát sau.
