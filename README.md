# 📩 Gmail OAuth Token Guide (gmail.modify scope)

Hướng dẫn từng bước lấy `access_token` từ Google OAuth Playground để sử dụng Gmail API với scope:

https://www.googleapis.com/auth/gmail.modify

---

## 🚀 0. Pull Docker image (optional)

Trước khi chạy ứng dụng, mình pull image:

docker pull dangnguyenpy/mail-app:latest

---

## 🚀 1. Truy cập OAuth Playground

Mình truy cập:

https://developers.google.com/oauthplayground/

---

## 🔐 2. Chọn scope Gmail API

Trong ô "Input your own scopes" hoặc danh sách API bên trái, mình nhập:

https://www.googleapis.com/auth/gmail.modify

Sau đó:
- Tick chọn scope này  
- Nhấn "Authorize APIs"

---

## 🔑 3. Đăng nhập Google Account

- Chọn tài khoản Gmail mình muốn sử dụng  
- Nhấn "Allow / Cho phép" để cấp quyền  

---

## 🔄 4. Exchange Authorization Code

Sau khi authorize thành công:
- Nhấn nút "Exchange authorization code for tokens"

---

## 📦 5. Lấy Access Token

Ở phần response JSON bên phải sẽ hiển thị:

{
  "access_token": "ya29.a0AfH6SMxxxxxxxxxxxx",
  "expires_in": 3599,
  "refresh_token": "1//0gxxxxxxxxxxxx",
  "scope": "https://www.googleapis.com/auth/gmail.modify",
  "token_type": "Bearer"
}

👉 Mình copy giá trị:

access_token

---

## ⚠️ Lưu ý quan trọng

- Access token chỉ tồn tại khoảng 1 giờ  
- Hết hạn phải lấy lại hoặc dùng refresh_token  
- Không chia sẻ token hoặc commit lên GitHub  

---

## 🧪 6. Sử dụng Access Token trong API

Khi gọi Gmail API, mình thêm header:

Authorization: Bearer YOUR_ACCESS_TOKEN

Ví dụ:

fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})

---

## 📥 7. Nhập token vào ứng dụng

- Mình mở ứng dụng  
- Dán access_token vào input/token field  
- Bắt đầu sử dụng Gmail API  

---

## 🎯 Tổng kết quy trình

1. Pull docker image  
2. Truy cập OAuth Playground  
3. Thêm scope gmail.modify  
4. Authorize Google account  
5. Exchange code lấy token  
6. Copy access_token  
7. Dán vào app để dùng Gmail API  

---

## 🚀 Kết quả

Sau khi hoàn tất, mình có thể:

- Gửi email qua Gmail API  
- Đọc / sửa / quản lý email  
- Tracking email trong hệ thống




Bạn lấy ở Google Cloud Console.

Các bước ngắn gọn:

Mở https://console.cloud.google.com/
Tạo hoặc chọn một project.
Vào APIs & Services → OAuth consent screen.
Cấu hình consent screen:
Chọn External
Điền app name, email
Thêm email của bạn vào Test users
Vào APIs & Services → Credentials.
Chọn Create Credentials → OAuth client ID.
Chọn loại Web application.
Thêm:
Authorized JavaScript origins: http://localhost:3000
Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
Tạo xong, Google sẽ trả:
Client ID
Client Secret
Điền vào .env.local: