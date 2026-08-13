# Kimlik bilgisi kasası

## Genel bakış

Sağlayıcı API anahtarları hiçbir zaman düz yapılandırma dosyalarında veya ortam değişkenlerinde tutulmaz. Bunlar **kimlik bilgisi kasasında** yaşar — herhangi bir çeviri veya yapay zekâ incelemesinin bir kimlik bilgisini kullanabilmesi için önce kilidinin açılması gereken şifrelenmiş bir depo. Kilidi tarayıcı oturumu başına bir kez açarsınız; kimlik bilgileri yalnızca bellekte çözülür.

<!-- local-only -->
## Parola kasası (kendi barındırdığınız kurulum)

Kendi barındırdığınız bir kurulumda kasa, şifrelenmiş bir yerel dosyadır. İlk kilit açma onu oluşturur: seçtiğiniz parola kasa parolası olur ve kaydettiğiniz her kimlik bilgisi dosyayı yeniden şifreler. Parolanın kendisi hiçbir zaman saklanmaz — parola olmadan dosyanın kilidi çözülemez. **Genel yapılandırmadan** ya da herhangi bir *Kasa kilitli* kartından kilidini açın.
<!-- /local-only -->

## Cihaza bağlı kasa (bulut)

Bulut sürümünde kasa **sunucuda şifrelenmiş** olarak saklanır ve kilidini açmak iki etken gerektirir:

- **Parolanız** — sunucuda veya cihazda hiçbir yerde saklanmaz.
- **Cihaz başına bir anahtar** — bir cihazı kaydettiğinizde tarayıcınızda oluşturulur ve yalnızca o cihazda tutulur.

Kilidini açtığınızda her iki etken de şifreli bağlantı üzerinden gider ve şifre çözme anahtarını **yalnızca bellekte, yalnızca oturumunuz için** türetmek üzere sunucu tarafında birleştirilir. Ne etkenlerden biri ne de türetilen anahtar hiçbir zaman sunucu depolamasına yazılmaz — saklanan tek şey şifrelenmiş kasanın kendisidir. Bu yüzden yalnızca sunucuda saklanan veriler kimlik bilgilerinizi ortaya çıkaramaz ve sızdırılmış bir parola tek başına da yeterli değildir: kilidi açmak, kayıtlı cihazlarınızdan birini de gerektirir.

Genel yapılandırma bir parola istemi yerine bir **Kasa sayfasına git** düğmesi gösteriyorsa cihaza bağlı kasadasınız demektir — Kasa sayfası kurulumu, cihaz kaydını, kilit açmayı, kimlik bilgisi düzenlemelerini ve parola değişikliklerini yönetir.

## Bilmekte fayda var

- Daha önce hiç kullanmadığınız bir cihazın kilidi açabilmesi için önce Kasa sayfasında **kaydedilmesi** gerekir.
- Parolanızı (ya da bulutta, kayıtlı her cihazınızı) kaybederseniz kasanın içeriği kurtarılamaz — kasayı yeniden kurup sağlayıcı anahtarlarınızı yeniden girmeniz gerekir.
- Uygulamanın günlüğe kaydettiği her şey karartmadan geçer, bu yüzden kimlik bilgisi değerleri hiçbir zaman günlüklerde görünmez.
