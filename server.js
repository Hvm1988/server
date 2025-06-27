const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const xml2js = require('xml2js');
const path = require('path');
const cors = require('cors');

fs.ensureDirSync('uploads');
fs.ensureDirSync('panos');

const app = express();

// Bật CORS để client khác domain có thể gọi
app.use(cors());

// Phục vụ file tĩnh như index.html, upload.html, panos/
app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));

// Cấu hình multer để lưu file vào thư mục uploads/
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// Route xử lý upload ảnh và cập nhật tour.xml
app.post('/', upload.single('pano'), async (req, res) => {
    console.log('📥 Nhận upload mới...');

    try {
        const { sceneName, ath, atv, linkedscene } = req.body;
        const file = req.file;

        if (!file) return res.status(400).send('Không có ảnh được chọn');

        const panoFileName = path.basename(file.path);
        const targetPath = `panos/${panoFileName}`;

        // Di chuyển ảnh từ uploads → panos
        await fs.move(file.path, targetPath);
        console.log('✅ Đã chuyển ảnh vào panos/');

        // Đọc và parse tour.xml
        const xmlPath = 'tour.xml';
        const xmlContent = await fs.readFile(xmlPath, 'utf8');
        const parser = new xml2js.Parser();
        const builder = new xml2js.Builder({ headless: true });

        const result = await parser.parseStringPromise(xmlContent);
        result.krpano.scene = result.krpano.scene || [];

        // Tạo scene mới
        const newScene = {
            $: {
                name: sceneName,
                title: sceneName,
                preload: 'false'
            },
            view: [{
                $: {
                    hlookat: "0.0",
                    vlookat: "0.0",
                    fovtype: "MFOV",
                    fov: "120",
                    fovmin: "70",
                    fovmax: "140",
                    limitview: "auto"
                }
            }],
            image: [{
                cube: [{
                    $: {
                        url: `panos/${panoFileName}`
                    }
                }]
            }],
            hotspot: [{
                $: {
                    name: `hotspot_${sceneName}`,
                    style: "skin_hotspotstyle",
                    ath: ath,
                    atv: atv,
                    linkedscene: linkedscene,
                    use3dtransition: "true"
                }
            }]
        };

        // Thêm scene mới vào danh sách
        result.krpano.scene.push(newScene);
        const updatedXML = builder.buildObject(result);
        await fs.writeFile(xmlPath, updatedXML, 'utf8');
        console.log('✅ Đã cập nhật tour.xml');

        res.redirect('/index.html');
    } catch (err) {
        console.error('❌ Lỗi khi xử lý upload:', err);
        res.status(500).send('Lỗi xử lý upload');
    }
});

// 👉 Dùng port được truyền qua biến môi trường hoặc mặc định 3000
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`🚀 Server chạy tại cổng ${port}`);
});
