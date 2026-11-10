# Notes API + Nginx

Notes API (Express + PostgreSQL) di belakang nginx: satu pintu masuk, 3 replica backend,
load balancing, rate limit, header keamanan, dan gzip.

```
klien -> nginx :8081 -> upstream backend (api x3) -> db
```

## Cara menjalankan

```bash
git mv docker-compose.yml compose.yaml   # jika belum diganti namanya
docker compose up -d --build
docker compose ps
```

Semua request lewat `http://localhost:8081/api/...` (contoh: `/api/notes`).
Hentikan dengan `docker compose down` (tambah `-v` untuk menghapus data).

Siapkan beberapa data dulu agar respons cukup besar untuk di-gzip:

```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8081/api/notes \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Catatan $i\",\"content\":\"Isi catatan nomor $i untuk uji gzip dan load balancing\"}" > /dev/null
  sleep 0.3
done
```

## Bukti

> Tempel output asli dari terminal kamu di setiap blok di bawah.

### 1. Load balancing (X-Upstream berganti)

```bash
for i in 1 2 3 4 5 6; do curl -s -D - -o /dev/null http://localhost:8081/api/notes | grep -i x-upstream; sleep 0.3; done
```

```text
X-Upstream: 172.18.0.5:3000
X-Upstream: 172.18.0.4:3000
X-Upstream: 172.18.0.3:3000
X-Upstream: 172.18.0.5:3000
X-Upstream: 172.18.0.4:3000
X-Upstream: 172.18.0.3:3000
```

### 2. Rate limit (muncul 429)

```bash
for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/notes; done | sort | uniq -c
```

```text
     21 200
      9 429
```

### 3. Header keamanan dan gzip

```bash
sleep 2
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" http://localhost:8081/api/notes
```

```text
HTTP/1.1 200 OK
Server: nginx/1.27.5
Date: Tue, 10 Nov 2026 16:19:46 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
Vary: Accept-Encoding
X-Powered-By: Express
ETag: W/"36c-bM+UVtI6j0zq8ybGm9fb0rPXIkw"
X-Upstream: 172.18.0.5:3000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Content-Encoding: gzip
```

### 4. Port backend lama tidak bisa diakses

```bash
curl -v --max-time 5 http://localhost:3000/notes
docker compose ps
```

```text
* Host localhost:3000 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:3000...
*   Trying 127.0.0.1:3000...
* connect to ::1 port 3000 from :: port 50486 failed: Connection refused
* connect to 127.0.0.1 port 3000 from 0.0.0.0 port 50487 failed: Connection refused
* Failed to connect to localhost port 3000 after 2288 ms: Could not connect to server
* closing connection #0
curl: (7) Failed to connect to localhost port 3000 after 2288 ms: Could not connect to server
NAME                IMAGE                COMMAND                  SERVICE   CREATED         STATUS                   PORTS
notes-api-api-1     notes-api-api        "docker-entrypoint.s…"   api       7 minutes ago   Up 7 minutes (healthy)   3000/tcp
notes-api-api-2     notes-api-api        "docker-entrypoint.s…"   api       7 minutes ago   Up 7 minutes (healthy)   3000/tcp
notes-api-api-3     notes-api-api        "docker-entrypoint.s…"   api       7 minutes ago   Up 7 minutes (healthy)   3000/tcp
notes-api-db-1      postgres:16-alpine   "docker-entrypoint.s…"   db        8 minutes ago   Up 8 minutes (healthy)   5432/tcp
notes-api-nginx-1   nginx:1.27-alpine    "/docker-entrypoint.…"   nginx     7 minutes ago   Up 7 minutes             0.0.0.0:8081->80/tcp, [::]:8081->80/tcp
```

## Jawaban pertanyaan

**(a) Kenapa upstream perlu `zone`? Apa yang terjadi kalau dihapus?**
`zone` membuat konfigurasi dan status upstream (urutan round-robin, hitungan gagal, dan sebagainya)
disimpan di shared memory yang dipakai semua worker process nginx. Tanpa `zone`, setiap worker
menyimpan salinannya sendiri, sehingga pembagian beban dan deteksi server gagal tidak konsisten
antar worker dan tidak ada gambaran tunggal tentang kondisi backend.

**(b) Kenapa `limit_req_status` diganti ke 429? Apa bedanya dengan bawaan nginx?**
Bawaan nginx menolak dengan 503 Service Unavailable, yang berarti server bermasalah. 429 Too Many
Requests menyatakan dengan jelas bahwa klien terlalu sering mengirim request, sehingga klien bisa
melakukan backoff/retry dengan benar dan monitoring tidak salah mengira ada gangguan server.

**(c) Kenapa backend dan database tidak punya `ports`, dan nginx menjangkau backend lewat apa?**
Tanpa `ports`, container tidak dipublikasikan ke host sehingga hanya bisa dijangkau dari network
internal compose; satu-satunya pintu masuk (dan permukaan serangan) adalah nginx. Nginx menjangkau
backend lewat network compose memakai nama service `api:3000`, yang di-resolve DNS internal Docker
ke IP ketiga replica.
