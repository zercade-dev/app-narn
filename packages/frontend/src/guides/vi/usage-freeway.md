# NARN Freeway

## Tổng quan

**NARN Freeway** là một kho dùng chung gồm các mô hình AI ở gói miễn phí mà ứng dụng tự động điều phối công việc tới — không cần thẻ tín dụng. Khóa nhà cung cấp vẫn do bạn cung cấp; thứ Freeway thêm vào là phần sổ sách. Nó theo dõi mỗi nhà cung cấp còn bao nhiêu hạn mức miễn phí, chọn mô hình cho từng lô, và chuyển sang mô hình khác khi một mô hình bị giới hạn tần suất hoặc đã hết phần trong ngày.

Trỏ điều phối tới Freeway và bạn sẽ không bao giờ phải chọn mô hình nữa: công việc qua Freeway không có thiết lập mô hình lẫn mức độ suy luận, bởi lựa chọn được đưa ra theo từng lô, từng ngôn ngữ, trong số những gì kho có thể phục vụ ngay lúc đó.

## Cách bật

Một dự án mới tinh chưa có quy tắc điều phối sẽ hiện nút **Để NARN Freeway xử lý mọi thứ** ở tab [Điều phối](guide:usage-routing) — một cú nhấp tạo ra quy tắc bao trùm trỏ tới kho miễn phí.

Ngoài ra, hãy chọn **NARN Freeway** như bất kỳ nhà cung cấp nào khác: ở bộ chọn đơn giản của tab Điều phối để gửi cả dự án tới đó, hoặc làm mô-đun của một quy tắc riêng trong **Nâng cao** để dùng nó cho vài ngôn ngữ và nhà cung cấp trả phí cho những ngôn ngữ còn lại.

Trước tiên cần hai thứ: ít nhất một nhà cung cấp miễn phí đã lưu khóa trong [kho bảo mật](guide:usage-vault), và kho đang mở khóa — khi kho còn khóa, mọi nhà cung cấp Freeway đều hiện ra như chưa có khóa.

## Nó dùng những nhà cung cấp nào

Freeway dựa vào gói miễn phí của những nhà cung cấp bạn đã cấu hình sẵn thành mô-đun. Hiện nó biết cách dùng:

* **Google AI (Gemini)** — hạn mức miễn phí lớn nhất, và là nguồn của phần lớn các mô hình mạnh nhất trong kho.
* **Groq** — nhanh, với số lượt yêu cầu mỗi ngày rộng rãi.
* **OpenRouter** — các mô hình miễn phí mà nó lưu trữ.
* **DeepL** — hạn mức ký tự hằng tháng của gói miễn phí, cho dịch máy cổ điển.

<!-- local-only -->

* **GitHub Copilot** — nếu bạn có gói đăng ký Copilot.

<!-- /local-only -->

Nhà cung cấp mà bạn chưa nhập khóa thì đơn giản là bị bỏ qua. Thêm một khóa nữa sẽ mở rộng kho và giảm khả năng một lần chạy phải chờ.

## Theo dõi kho

Bảng **NARN Freeway** trên màn hình cấu hình cho bạn thấy cả kho trong một cái nhìn: trạng thái khóa của từng nhà cung cấp, và với mỗi mô hình là **Trạng thái**, hạn mức **Còn lại**, **Đặt lại tiếp theo**, cùng **Tỷ lệ đạt** gần đây theo từng ngôn ngữ.

Mỗi nhà cung cấp còn có một menu thả xuống bên cạnh để kiểm soát cách Freeway dùng nó: **Tự động** để kho tự chọn như thường lệ, chọn một thực thể có tên sẽ ghim Freeway vào đúng tài khoản đó, còn **Đã tắt** đưa nhà cung cấp đó ra khỏi kho hoàn toàn — mà không tắt mô-đun ở bất kỳ nơi nào khác. Chuyển một nhà cung cấp đã tắt trở lại Tự động (hoặc một thực thể có tên) sẽ tiếp tục đúng chỗ nó dừng lại.

Trạng thái của một mô hình là một trong số:

* **Sẵn sàng** — dùng được ngay.
* **Đang hạ nhiệt** — bị giới hạn tần suất trong chốc lát; nó tự quay lại.
* **Hết cho hôm nay** — hạn mức trong ngày đã dùng hết, và bảng cho biết khi nào đặt lại.
* **Mô-đun đang tắt** — khóa đã lưu nhưng mô-đun bị tắt. Bảng sẽ mời bạn bật nó.
* **Đã tắt cho Freeway** — bạn đã tắt nhà cung cấp này cho kho từ menu thả xuống của nó; phần còn lại của mô-đun không bị ảnh hưởng.
* **Không có khóa** — kho chưa có gì cho nhà cung cấp này.
* **Thông tin xác thực không hợp lệ** — khóa bị từ chối. Hãy ghi một khóa hoạt động được vào kho để gỡ dấu này.

## Khi hạn mức miễn phí cạn

Một lần chạy làm cạn kho sẽ không thất bại. Nó chuyển sang **Đang chờ hạn mức miễn phí**, giữ lại những cặp chưa làm, và tự tiếp tục ngay khi hạn mức của một nhà cung cấp được đặt lại — bạn có thể để đó rồi quay lại sau.

Nếu không muốn chờ, hãy mở lần chạy đó ở tab [Hoạt động](guide:usage-activity) và dùng **Tiếp tục ngay với…** để hoàn tất các cặp còn lại bằng một nhà cung cấp trả phí, hoặc **Thử lại kho miễn phí** để thử lại kho ngay lập tức.

## Bậc chất lượng, và chỉ nâng cấp phần thật sự cần

Các mô hình miễn phí không giỏi như nhau, nên mỗi mô hình mang một **bậc chất lượng** từ 1 đến 4, với 4 là mạnh nhất. Mỗi bản dịch đều ghi lại bậc của mô hình đã tạo ra nó, và điều đó biến "dịch hết miễn phí" thành một lượt đầu dùng được:

1. Dịch toàn bộ dự án qua Freeway mà không tốn gì.
2. Ở tab **Bản dịch**, lọc theo **Dưới bậc** để xem phần nào do mô hình yếu hơn đảm nhận.
3. Chọn những mục đó rồi dùng **Dịch lại dưới bậc** để làm lại đúng phần ấy với một nhà cung cấp tốt hơn.

Rốt cuộc bạn chỉ trả tiền cho những mục thật sự cần.

## Freeway còn dùng được ở đâu

Freeway không chỉ dành cho dịch thuật. Nó cũng có sẵn làm mô-đun cho **rà soát AI**, **rà soát nguồn**, cùng việc tạo **bảng thuật ngữ** và **danh mục** — ở mỗi trường hợp nó tự chọn mô hình miễn phí phù hợp nhất cho công việc và ẩn đi thiết lập mô hình lẫn mức độ suy luận, vì chẳng còn gì để chọn. Xem [Rà soát AI](guide:usage-ai-review), [Bảng thuật ngữ](guide:usage-glossary) và [Danh mục](guide:usage-category).
