# Sử dụng Docker

## Tổng quan

Ứng dụng được đóng gói dưới dạng một Docker image cùng một tệp `docker-compose.yml` khởi động **hai dịch vụ**: `app` (phục vụ cả API lẫn giao diện đã build trên cùng một cổng) và một cơ sở dữ liệu `postgres` **bắt buộc**. Việc lưu trữ dữ liệu dùng Postgres ở mọi nơi, nên máy chủ sẽ không khởi động được nếu thiếu nó. Theo mặc định, `docker compose up` sẽ kéo image `:main` đã phát hành (`ghcr.io/zercade-dev/narn:main`) từ GHCR và khởi động một Postgres 17 chính thức cùng với nó.

## Yêu cầu

* Đã cài **Docker** và **Docker Compose**.
* Image của ứng dụng chỉ được build cho **amd64**. Trên Apple Silicon nó vẫn chạy được — Docker thực thi nó qua giả lập.
* Nếu image ở chế độ riêng tư với tài khoản của bạn, hãy chạy `docker login ghcr.io` một lần (với một token có quyền `read:packages`) trước lần kéo image đầu tiên.

## Chạy ứng dụng

Từ thư mục chứa `docker-compose.yml` — thư mục gốc của mã nguồn NARN:

```
docker compose up
```

Compose khởi động Postgres trước, chờ healthcheck của nó, rồi mới khởi động ứng dụng. Khi ứng dụng đã khỏe mạnh, mở nó tại `http://localhost:3001`.

Bộ dịch vụ này dùng hai volume có tên để dữ liệu của bạn còn nguyên sau khi khởi động lại:

* **`translator-db`** — thư mục dữ liệu Postgres, nơi các **dự án** và **bộ nhớ dịch** của bạn nằm.
* **`translator-data`** — tệp kho bảo mật cục bộ cùng các bản sao lưu và bản chụp tự động theo từng dự án.

Postgres không công bố cổng nào ra máy chủ và nằm trên một mạng Docker nội bộ, nên chỉ container của ứng dụng mới truy cập được nó.

## Đổi cổng máy chủ

Container luôn lắng nghe ở cổng **3001** bên trong Docker. Tệp compose ánh xạ nó tới cùng cổng đó trên máy của bạn:

```
ports:
  - "127.0.0.1:3001:3001"
```

Nếu cổng 3001 đã có người dùng, hãy đổi **vế bên trái (máy chủ)** của phần ánh xạ — phần trước dấu hai chấm thứ hai. Ví dụ, để phục vụ ở cổng 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

Khi đó ứng dụng có thể truy cập tại `http://localhost:8000`.

**Không** đổi các biến môi trường `HOST` hay `PORT` — những biến đó là nội bộ container (máy chủ gắn vào `0.0.0.0:3001` bên trong container để Docker có thể chuyển tiếp tới nó). Chỉ vế máy chủ của ánh xạ `ports` mới quyết định địa chỉ trên máy của bạn.

Tiền tố `127.0.0.1:` giữ cho ứng dụng chỉ gắn vào loopback, đúng với định hướng chỉ dành cho một người dùng, chỉ chạy cục bộ của ứng dụng. Hãy giữ nguyên tiền tố này trừ khi bạn có lý do cụ thể để mở ứng dụng ra bên ngoài.
