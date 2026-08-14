# Tab Chất lượng

## Tổng quan

Tab **Chất lượng** là một bảng điều khiển tổng hợp các kết quả LQA (Linguistic Quality Assurance) được tạo ra mỗi khi các mục được dịch. Nó hiển thị tỷ lệ đạt tổng thể của bạn và những nơi vấn đề tập trung, để bạn nhanh chóng tìm ra khu vực có vấn đề. Bảng này được điền dần khi bạn dịch — nếu nó trống, hãy chạy một lượt dịch trước.

## Nó hiển thị gì

* **Tỷ lệ đạt tổng thể** trên mọi kết quả LQA và các mục mà chúng bao phủ.
* **Tỷ lệ đạt theo ngôn ngữ** — chất lượng theo từng ngôn ngữ đích.
* **Vấn đề theo nguồn** — số lượng theo từng loại vấn đề, gom theo nhãn nguồn gốc.
* **Chất lượng theo mô-đun** — tỷ lệ đạt và các vấn đề, gom theo mô-đun đã tạo ra từng bản dịch.

## Đi sâu vào chi tiết

Bấm vào bất kỳ ô nào để nhảy tới các mục tương ứng — bảng điều khiển sẽ lọc bảng **Bản dịch** xuống chỉ còn các mục bị ảnh hưởng để bạn sửa chúng.

## Các kiểm tra này đến từ đâu

Mỗi bản dịch đi qua cổng LQA, chạy các kiểm tra bạn đã bật ở bảng *Kiểm tra LQA* trong tab **Cấu hình** (trùng khớp thẻ, giới hạn độ dài, tràn, tuân thủ bảng thuật ngữ, thuật ngữ bị cấm, khẳng định regex, và nhiều hơn nữa). Kiểm tra ở mức **Chặn** khiến cổng không đạt và có thể kích hoạt một lần thử lại tự động; kiểm tra ở mức **Cảnh báo** được báo cáo ở đây mà không chặn. Điều chỉnh những kiểm tra nào chạy, và mức nghiêm trọng của chúng, ở Cấu hình.
