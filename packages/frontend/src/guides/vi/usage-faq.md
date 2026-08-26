# Hỏi và đáp

## Tổng quan

Những câu trả lời ngắn cho các thắc mắc hay gặp nhất, mỗi câu đều dẫn tới hướng dẫn trình bày chủ đề đó thật đầy đủ. Danh sách này lớn dần theo các câu hỏi gửi về, nên nếu câu của bạn chưa có ở đây, danh sách chủ đề bên trái đi sâu hơn nhiều.

## Những gì được dịch

### Một lần chạy dịch những mục nào, và bỏ qua những mục nào?

Chỉ những mục vẫn còn cần dịch. Với mỗi mục và mỗi ngôn ngữ đích bạn đã chọn, lần chạy sẽ dịch cặp đó khi nó chưa có bản dịch — hoặc khi bạn yêu cầu rõ ràng **dịch lại**. Cặp đã có nội dung sẽ được giữ nguyên, nên chạy lại bản dịch không bao giờ ghi đè lên công sức bạn đã làm hoặc đã rà soát.

Một mục, hoặc một cặp mục-và-ngôn-ngữ cụ thể, sẽ bị loại ra khi có bất kỳ điều nào sau đây:

* **Nó đã được dịch**, và bạn không yêu cầu dịch lại.
* **Bạn đã đánh dấu Đã bỏ qua.** Việc này đưa nó ra khỏi *mọi* thao tác AI — dịch, rà soát AI, rà soát nguồn, tạo bảng thuật ngữ và danh mục. Các mục đã bỏ qua vẫn hiện trong bảng kèm một nhãn, nên quyết định đó luôn nhìn thấy được và luôn có thể đảo ngược.
* **Nó đã mồ côi** — nó biến mất khỏi lần nhập CSV gần nhất và đang chờ ở tab [Mục mồ côi](guide:usage-orphans).
* **Nó được nhập với `Muốn dịch chứ? = FALSE`.** Xem bên dưới.
* **Đích chính là ngôn ngữ nguồn.** Một mục không bao giờ được dịch sang chính ngôn ngữ nguồn của nó, kể cả khi bạn chọn ngôn ngữ đó làm đích.
* **Không có gì để dịch.** Văn bản rỗng, một con số như `3.14` hay `100%`, một URL đứng riêng, một mã màu như `#ff8800`, hoặc một chuỗi chỉ gồm thẻ và chỗ giữ chỗ như `<b>{count}</b>` đều được sao chép nguyên vẹn, không gọi tới nhà cung cấp nào.

Một mục được điền từ [Bộ nhớ dịch](guide:usage-translation-memory) cũng không bao giờ đến tay nhà cung cấp — bản dịch đã lưu được dùng lại. Nó vẫn được tính là đã dịch.

### Tôi có thể dịch lại thứ đã dịch rồi không?

Được, nhưng bạn phải yêu cầu, vì mặc định các lần chạy bỏ qua những cặp đã xong. Đánh dấu **dịch lại** trong hộp thoại *Dịch…* cho cả lô, hoặc dùng **Dịch lại** trên một hàng cụ thể ở tab [So sánh](guide:usage-compare) hay trong hàng đợi rà soát thủ công.

### Vì sao một mục quay lại mà văn bản nguồn không đổi?

Gần như luôn là vì không có gì để dịch — gạch đầu dòng cuối trong danh sách trên. Con số, URL, mã màu và đánh dấu thuần túy đều được nhận diện rồi sao chép nguyên vẹn, bởi một mô hình chỉ có thể lặp lại hoặc làm hỏng chúng. Với những mục này, không có gì được gửi tới nhà cung cấp và không phát sinh chi phí.

### Cột "Muốn dịch chứ?" trong CSV của tôi là gì, và khác Đã bỏ qua ở chỗ nào?

**Muốn dịch chứ?** là một cột nhập tùy chọn. Hàng có giá trị `FALSE` vẫn được nhập và giữ lại, nhưng được coi là không dịch: nó bị lọc hoàn toàn khỏi tab **Bản dịch** và không bao giờ vào một lần chạy. Hãy dùng cho những hàng phải đi một vòng CSV mà vẫn nguyên vẹn. Cột này chỉ được đặt lúc nhập — trong ứng dụng không có công tắc nào cho nó — nên muốn đổi thì sửa cột rồi nhập lại.

**Đã bỏ qua** là thứ tương đương ngay trong ứng dụng, và khác ở một điểm đáng kể: mục đã bỏ qua vẫn hiện trong bảng kèm nhãn, nên bạn nhìn thấy nó và có thể đổi ý. Dùng *Muốn dịch chứ?* cho những hàng ứng dụng không bao giờ nên hiển thị, và **Bỏ qua mục** cho những hàng bạn còn muốn để mắt tới.

## Nhà cung cấp, mô hình và điều phối

### Tôi đổi mô hình dùng để dịch ở đâu?

Có ba cấp, và cấp bạn cần tùy vào việc thay đổi nên áp dụng rộng đến đâu:

1. **Cho một nhà cung cấp ở mọi nơi** — mở **Cấu hình chung**, tìm mô-đun và chọn **mô hình** của nó tại đó. Mọi dự án đặt ở *Kế thừa từ cấu hình chung* đều theo.
2. **Cho một dự án** — mở tab [Cấu hình](guide:usage-config) của dự án đó và đặt **mô hình** (cùng **mức độ suy luận**) cho mô-đun, thay vì kế thừa.
3. **Chỉ cho một số mục** — mở tab [Điều phối](guide:usage-routing), chuyển sang **Nâng cao** và đặt **ghi đè mô hình** trên một quy tắc điều phối. Chỉ những mục khớp quy tắc đó mới dùng nó.

Chế độ xem đơn giản của tab Điều phối chọn **nhà cung cấp**, không phải mô hình: nó cố ý chạy đúng mô hình mà mô-đun đó đã được cấu hình.

### Các ngôn ngữ khác nhau có dùng nhà cung cấp khác nhau được không?

Được. Chuyển tab [Điều phối](guide:usage-routing) sang **Nâng cao** và thêm một quy tắc cho mỗi ngôn ngữ — hoặc theo danh mục, hoặc theo độ dài mục. Các quy tắc được xét theo thứ tự ưu tiên và quy tắc đầu tiên khớp với một mục sẽ thắng. Nếu bạn không muốn chọn gì cả, hãy trỏ một quy tắc duy nhất tới [NARN Freeway](guide:usage-freeway) và để nó chọn mô hình miễn phí cho từng lô.

### Bản dịch không khởi động và báo không có quy tắc điều phối. Giờ sao?

Một lần chạy chỉ bắt đầu khi mọi ngôn ngữ trong đó đều có nơi để đi. Nếu một ngôn ngữ đích không khớp quy tắc nào, lần chạy bị từ chối trước khi bất cứ thứ gì được gửi đi, và thông báo sẽ nêu tên ngôn ngữ đó. Mở tab [Điều phối](guide:usage-routing) và thêm một quy tắc bao được nó — bộ chọn nhà cung cấp đơn giản bao hết mọi ngôn ngữ cùng lúc — rồi chạy lại.

## Lần chạy, lỗi và khôi phục

### Một số chuỗi bị lỗi. Tôi có phải chạy lại toàn bộ không?

Không. Dùng **Thử lại các mục lỗi** trên lần chạy đó ở tab [Hoạt động](guide:usage-activity): nó chỉ chạy lại những cặp mục-và-ngôn-ngữ bị lỗi, còn mọi thứ đã thành công thì giữ nguyên.

### Vì sao tôi phải mở khóa kho lần nữa?

[Kho bảo mật](guide:usage-vault) được mở khóa theo phiên, không phải vĩnh viễn, và nó cũng tự khóa lại sau một khoảng không hoạt động. Cứ mở khóa rồi làm tiếp. Nếu lúc nó khóa đang có một lần chạy dở dang, sau đó hãy dùng **Thử lại các mục lỗi** trên lần chạy ấy.

### Tôi nhập lại CSV và một số bản dịch biến mất. Chúng mất rồi à?

Không. Khi lần nhập lại không còn chứa một mục, các bản dịch của nó được giữ ở tab [Mục mồ côi](guide:usage-orphans) thay vì bị xóa. **Liên kết lại** mục mồ côi với mục đã thay thế nó để chuyển các bản dịch sang; ở mục đích chỉ những ngôn ngữ còn trống mới được điền, nên không có gì bị ghi đè. Ngoài ra, một ảnh chụp được tạo tự động ngay trước mỗi lần nhập, nên bạn có thể hoàn nguyên cả dự án từ tab [Sao lưu](guide:usage-backup).
