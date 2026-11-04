# NARN Freeway

## Tổng quan

**NARN Freeway** là một kho dùng chung gồm các mô hình AI ở gói miễn phí mà ứng dụng tự động điều phối công việc tới — không cần thẻ tín dụng. Khóa nhà cung cấp vẫn do bạn cung cấp; thứ Freeway thêm vào là phần sổ sách. Nó theo dõi mỗi nhà cung cấp còn bao nhiêu hạn mức miễn phí, chọn mô hình cho từng lô, và chuyển sang mô hình khác khi một mô hình bị giới hạn tần suất hoặc đã hết phần trong ngày.

Trỏ điều phối tới Freeway và bạn sẽ không bao giờ phải chọn mô hình nữa: công việc qua Freeway không có thiết lập mô hình lẫn mức độ suy luận, bởi lựa chọn được đưa ra theo từng lô, từng ngôn ngữ, trong số những gì kho có thể phục vụ ngay lúc đó.

## Cách bật

Một dự án mới tinh chưa có quy tắc điều phối sẽ hiện nút **Để NARN Freeway xử lý mọi thứ** ở tab [Điều phối](guide:usage-routing) — một cú nhấp tạo ra quy tắc bao trùm trỏ tới kho miễn phí. Dù không nhấp nút đó, một dự án hoàn toàn không có quy tắc vẫn được dịch qua Freeway cho đến khi bạn chọn nhà cung cấp.

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

Bảng **NARN Freeway** trên màn hình cấu hình cho bạn thấy cả kho trong một cái nhìn: trạng thái khóa của từng nhà cung cấp, và với mỗi mô hình là **Trạng thái**, hạn mức **Còn lại**, **Đặt lại tiếp theo**, cùng ba điểm số từ 0 đến 100 — chất lượng **Bản dịch**, **Tốc độ** và **Tổng thể** — rồi đến **Tỷ lệ đạt** gần đây theo từng ngôn ngữ. Mô hình quá chậm cho công việc theo lô sẽ hiện **Quá chậm** thay cho điểm tốc độ, còn **Chưa đo** nghĩa là NARN chưa có dữ liệu về nó.

Có hai thiết lập nằm phía trên danh sách nhà cung cấp. **Ưu tiên** chọn cách kho cân bằng giữa chất lượng và tốc độ: **Chất lượng** ưu tiên chất lượng bản dịch và chỉ dùng tốc độ để phân định khi bằng nhau, **Cân bằng** (mặc định) tránh các mô hình chậm khi có mô hình nhanh hơn mà vẫn tốt, còn **Tốc độ** ưu tiên các mô hình nhanh hơn nhưng vẫn bảo vệ chất lượng bản dịch. **Luôn tiếp tục với mô hình chất lượng thấp hơn** quyết định điều xảy ra khi chỉ còn các mô hình yếu hơn — xem bên dưới.

Mỗi nhà cung cấp còn có một menu thả xuống bên cạnh để kiểm soát cách Freeway dùng nó: **Tự động** để kho tự chọn như thường lệ, chọn một thực thể có tên sẽ ghim Freeway vào đúng tài khoản đó, còn **Đã tắt** đưa nhà cung cấp đó ra khỏi kho hoàn toàn — mà không tắt mô-đun ở bất kỳ nơi nào khác. Menu thả xuống chỉ chi phối các lựa chọn tự động của kho và là thiết lập của riêng tài khoản bạn: một quy tắc điều phối trỏ thẳng tới nhà cung cấp đó vẫn tiếp tục dùng nó, còn những người khác cùng làm việc trong dự án của bạn bằng điều phối riêng của họ thì theo thiết lập Freeway của chính họ. Một lần chạy dịch đang diễn ra sẽ rời khỏi nhà cung cấp vừa bị tắt ngay từ lô tiếp theo; các lần chạy khác đã bắt đầu trước đó thì có thể hoàn tất bằng chính mô hình mà chúng đã khởi đầu. Chuyển một nhà cung cấp đã tắt trở lại Tự động (hoặc một thực thể có tên) sẽ tiếp tục đúng chỗ nó dừng lại.

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

## Khi chỉ còn các mô hình yếu hơn

Một số văn bản cần mô hình mạnh hơn những mô hình vẫn còn miễn phí. Khi các mô hình còn lại thấp hơn chất lượng mà một lần chạy cần, lần chạy đó sẽ **tạm dừng** và thẻ của nó trong thẻ [Hoạt động](guide:usage-activity) cho biết điều này, nêu tên mô hình tốt nhất còn lại và, khi biết được, khoảng khi nào các mô hình tốt hơn sẽ rảnh. Bạn có thể tiếp tục chờ, **Hủy lượt chạy**, hoặc chọn **Tiếp tục…** để hoàn tất bằng các mô hình chất lượng thấp hơn; lựa chọn này áp dụng cho phần còn lại của lần chạy đó, và các chuỗi do nó tạo ra được đánh dấu để bạn tìm và xem lại sau. Bật **Luôn tiếp tục với mô hình chất lượng thấp hơn** trong bảng Freeway để bỏ qua bước tạm dừng — các lần chạy khi đó hoàn tất mà không hỏi, và những chuỗi đó vẫn được đánh dấu.

## Bậc chất lượng, và chỉ nâng cấp phần thật sự cần

Các mô hình miễn phí không giỏi như nhau, nên mỗi mô hình mang một **bậc chất lượng** từ 1 đến 4, với 4 là mạnh nhất. Mỗi bản dịch đều ghi lại bậc của mô hình đã tạo ra nó, và điều đó biến "dịch hết miễn phí" thành một lượt đầu dùng được:

1. Dịch toàn bộ dự án qua Freeway mà không tốn gì.
2. Ở tab **Bản dịch**, lọc theo **Dưới bậc** để xem phần nào do mô hình yếu hơn đảm nhận.
3. Chọn những mục đó rồi dùng **Dịch lại dưới bậc** để làm lại đúng phần ấy với một nhà cung cấp tốt hơn.

Rốt cuộc bạn chỉ trả tiền cho những mục thật sự cần.

## Freeway còn dùng được ở đâu

Freeway không chỉ dành cho dịch thuật. Nó cũng có sẵn làm mô-đun cho **rà soát AI**, **rà soát nguồn**, cùng việc tạo **bảng thuật ngữ** và **danh mục** — ở mỗi trường hợp nó tự chọn mô hình miễn phí phù hợp nhất cho công việc và ẩn đi thiết lập mô hình lẫn mức độ suy luận, vì chẳng còn gì để chọn. Xem [Rà soát AI](guide:usage-ai-review), [Bảng thuật ngữ](guide:usage-glossary) và [Danh mục](guide:usage-category).
