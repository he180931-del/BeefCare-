export type LegalKind = 'terms' | 'policy'

export interface LegalSection {
  id: string
  title: string
  paragraphs: readonly string[]
}

export interface LegalDocument {
  title: string
  summary: string
  sections: readonly LegalSection[]
}

const section = (id: string, title: string, paragraphs: readonly string[]): LegalSection => ({ id, title, paragraphs })

export const LEGAL_DOCUMENTS: Record<LegalKind, LegalDocument> = {
  terms: {
    title: 'Điều khoản sử dụng',
    summary: 'Vui lòng đọc kỹ các điều khoản dưới đây trước khi đăng ký, truy cập hoặc sử dụng BeefCare. Việc tiếp tục sử dụng hệ thống được hiểu là bạn đã đọc, hiểu và đồng ý tuân thủ các nội dung này.',
    sections: [
      section('account', 'Tài khoản và đăng ký', [
        'Người dùng có trách nhiệm cung cấp thông tin đăng ký trung thực, chính xác và đầy đủ, bao gồm họ tên, địa chỉ thư điện tử, số điện thoại liên hệ và các thông tin cần thiết khác. Địa chỉ thư điện tử được sử dụng làm thông tin nhận diện tài khoản và có thể phải được xác minh trước khi người dùng được phép sử dụng đầy đủ các chức năng của BeefCare.',
        'Mỗi người dùng phải tự bảo đảm rằng thông tin tài khoản luôn được cập nhật. Việc hoàn tất hồ sơ cá nhân không đồng nghĩa với việc tự động tạo trang trại, cấp vai trò quản trị, thiết lập thành viên hoặc kích hoạt gói dịch vụ. BeefCare có quyền yêu cầu người dùng bổ sung hoặc xác minh thông tin khi cần thiết để bảo vệ tính chính xác và an toàn của hệ thống.',
      ]),
      section('authentication', 'Bảo mật và phương thức đăng nhập', [
        'Người dùng có nghĩa vụ bảo mật mật khẩu, tài khoản Google được liên kết và mọi thông tin xác thực khác. Người dùng không được cung cấp thông tin đăng nhập cho người không có thẩm quyền, không được sử dụng tài khoản của người khác và phải thông báo kịp thời khi phát hiện hoặc nghi ngờ tài khoản bị truy cập trái phép.',
        'BeefCare có thể áp dụng các biện pháp bảo vệ như giới hạn số lần đăng nhập sai, khóa tạm thời, yêu cầu xác minh lại hoặc kết thúc phiên đăng nhập có dấu hiệu bất thường. Khi đăng nhập bằng Google, Google chỉ hỗ trợ xác minh danh tính; người dùng vẫn phải chấp thuận riêng các điều khoản của BeefCare trước khi truy cập dữ liệu và chức năng nghiệp vụ.',
      ]),
      section('session', 'Phiên đăng nhập và thiết bị sử dụng', [
        'Phiên đăng nhập có thể hết hạn sau một khoảng thời gian không hoạt động hoặc theo thời hạn bảo mật được hệ thống quy định. Trường hợp người dùng lựa chọn ghi nhớ đăng nhập, phiên có thể được duy trì lâu hơn trên thiết bị đó; người dùng phải tự đánh giá mức độ an toàn của thiết bị trước khi sử dụng lựa chọn này.',
        'Người dùng phải đăng xuất khi sử dụng thiết bị dùng chung hoặc khi không còn kiểm soát thiết bị. BeefCare có thể kết thúc một hoặc nhiều phiên đăng nhập khi mật khẩu được thay đổi, tài khoản bị tạm ngưng, quyền truy cập thay đổi hoặc phát hiện rủi ro bảo mật. Việc đăng xuất có thể đồng thời xóa thông tin trang trại đang được chọn trên thiết bị.',
      ]),
      section('authorization', 'Vai trò và phạm vi truy cập', [
        'Quyền sử dụng chức năng được xác định theo vai trò của người dùng tại từng trang trại, bao gồm Chủ trại, Quản lý, Kỹ thuật viên hoặc vai trò khác được BeefCare hỗ trợ. Việc một trang trại xuất hiện trên giao diện hoặc được ghi trong địa chỉ truy cập không tự tạo quyền và không cho phép người dùng vượt quá phạm vi đã được cấp.',
        'Mọi yêu cầu nghiệp vụ có thể được máy chủ kiểm tra lại dựa trên trạng thái tài khoản, tư cách thành viên, vai trò và trang trại liên quan. Người dùng không được tìm cách né tránh cơ chế phân quyền, khai thác lỗi kỹ thuật, truy cập dữ liệu của trang trại khác hoặc thực hiện thao tác nhân danh người không có thẩm quyền.',
      ]),
      section('status', 'Trạng thái tài khoản và dịch vụ', [
        'BeefCare có thể hạn chế, tạm ngưng hoặc chấm dứt quyền truy cập khi tài khoản vi phạm điều khoản, có dấu hiệu gây mất an toàn, được yêu cầu bởi người có thẩm quyền hoặc thuộc trường hợp cần thiết để bảo vệ dữ liệu và hoạt động của hệ thống. Tài khoản đang bị tạm ngưng không được tiếp tục đăng nhập hoặc thực hiện nghiệp vụ.',
        'Khả năng sử dụng các chức năng tại trang trại còn phụ thuộc vào trạng thái hoạt động của trang trại, gói dịch vụ, thời hạn sử dụng và các giới hạn được áp dụng. Một số dữ liệu có thể chỉ được phép xem trong thời gian giới hạn hoặc trong phạm vi cần thiết để hoàn tất nghĩa vụ, xử lý tranh chấp và bảo đảm tính liên tục của hồ sơ.',
      ]),
      section('history', 'Dữ liệu nhập vào và lịch sử thao tác', [
        'Người dùng chịu trách nhiệm đối với tính hợp pháp, chính xác và phù hợp của dữ liệu do mình nhập, tải lên hoặc xác nhận trên BeefCare. Người dùng không được đưa vào hệ thống nội dung giả mạo, gây nhầm lẫn, xâm phạm quyền của bên thứ ba, chứa mã độc hoặc không liên quan đến hoạt động quản lý trang trại.',
        'Các thao tác quan trọng có thể được lưu cùng thời gian, tài khoản thực hiện và nội dung thay đổi nhằm phục vụ vận hành, kiểm tra và giải quyết tranh chấp. Việc sửa hoặc hủy một bản ghi nghiệp vụ không mặc nhiên xóa dấu vết trước đó. BeefCare có thể duy trì lịch sử cần thiết để bảo đảm tính toàn vẹn của hồ sơ và trách nhiệm của các bên.',
      ]),
    ],
  },
  policy: {
    title: 'Chính sách dữ liệu',
    summary: 'Chính sách này giải thích các loại dữ liệu BeefCare tiếp nhận và xử lý trong quá trình cung cấp dịch vụ quản lý trang trại, cũng như trách nhiệm của người dùng khi cung cấp và sử dụng dữ liệu.',
    sections: [
      section('account-data', 'Dữ liệu tài khoản', [
        'BeefCare có thể tiếp nhận và xử lý họ tên, địa chỉ thư điện tử, số điện thoại liên hệ, trạng thái tài khoản, phương thức đăng nhập, thông tin xác minh và các mốc thời gian liên quan. Những dữ liệu này được sử dụng để tạo và duy trì tài khoản, xác thực danh tính, liên hệ với người dùng và bảo vệ quyền truy cập.',
        'Khi người dùng đăng nhập bằng Google, BeefCare chỉ tiếp nhận các thông tin được cho phép trong phạm vi đăng nhập, chẳng hạn địa chỉ thư điện tử và thông tin nhận diện cơ bản. BeefCare không yêu cầu người dùng cung cấp mật khẩu Google và không được quyền sử dụng tài khoản Google ngoài phạm vi cần thiết cho việc đăng nhập.',
      ]),
      section('farm-data', 'Dữ liệu trang trại và thành viên', [
        'Hệ thống xử lý thông tin về trang trại, chủ sở hữu, thành viên, vai trò, lời mời tham gia, trạng thái dịch vụ và lịch sử thay đổi quyền. Dữ liệu này được dùng để xác định người nào được phép xem hoặc thực hiện thao tác trong từng trang trại và để ngăn việc truy cập vượt quá phạm vi được cấp.',
        'Người quản lý có thẩm quyền tại trang trại chịu trách nhiệm bảo đảm việc mời, cấp vai trò, thay đổi vai trò hoặc chấm dứt tư cách thành viên được thực hiện đúng đối tượng. Khi tư cách thành viên chấm dứt, quyền truy cập có thể bị thu hồi nhưng các dấu vết nghiệp vụ đã phát sinh hợp lệ trước đó vẫn có thể được lưu giữ.',
      ]),
      section('cattle-data', 'Dữ liệu vận hành đàn', [
        'BeefCare có thể lưu trữ hồ sơ nhận diện bò, nguồn gốc, nhập đàn, xuất đàn, chuồng nuôi, cân nặng, tăng trưởng, tiêm phòng, sức khỏe, điều trị, sinh sản, thức ăn và các thông tin vận hành liên quan. Phạm vi dữ liệu thực tế phụ thuộc vào chức năng mà trang trại lựa chọn sử dụng.',
        'Dữ liệu vận hành đàn được dùng để hỗ trợ theo dõi vòng đời, lập kế hoạch chăm sóc, phối hợp công việc và tạo báo cáo. Người dùng phải kiểm tra thông tin trước khi xác nhận, đặc biệt đối với dữ liệu có thể ảnh hưởng đến quyết định thú y, tài chính hoặc truy xuất nguồn gốc; BeefCare không thay thế đánh giá chuyên môn của người có đủ năng lực.',
      ]),
      section('service-data', 'Dữ liệu giao dịch và hỗ trợ', [
        'Trong quá trình cung cấp dịch vụ, BeefCare có thể xử lý thông tin về gói sử dụng, yêu cầu thanh toán, chứng từ, trạng thái đối soát, giao dịch liên quan và lịch sử xử lý. Hệ thống cũng có thể lưu nội dung phiếu hỗ trợ, tin nhắn, tệp đính kèm và kết quả giải quyết do người dùng cung cấp.',
        'Các dữ liệu này được sử dụng để xác nhận quyền sử dụng dịch vụ, xử lý thanh toán, giải quyết sai lệch, hỗ trợ người dùng và duy trì bằng chứng về quá trình xử lý. Người dùng không nên gửi thông tin nhạy cảm không cần thiết trong nội dung hỗ trợ và phải bảo đảm mình có quyền cung cấp các tài liệu được tải lên.',
      ]),
      section('purposes', 'Mục đích xử lý dữ liệu', [
        'BeefCare xử lý dữ liệu để xác thực tài khoản, cung cấp chức năng quản lý trang trại, thực thi phân quyền, duy trì lịch sử nghiệp vụ, gửi thông báo, hỗ trợ thanh toán, giải quyết yêu cầu và cải thiện tính ổn định của dịch vụ. Dữ liệu chỉ nên được sử dụng trong phạm vi phù hợp với mục đích đã nêu và chức năng người dùng lựa chọn.',
        'Một số thông tin kỹ thuật như thời gian truy cập, lỗi hệ thống, địa chỉ mạng hoặc đặc điểm thiết bị có thể được ghi nhận để phát hiện sự cố, ngăn chặn hành vi lạm dụng và bảo vệ an toàn. Việc xử lý dữ liệu không nhằm tự động trao quyền, thay đổi quyền sở hữu trang trại hoặc thay thế quyết định của người có thẩm quyền.',
      ]),
      section('protection', 'Bảo vệ và kiểm soát truy cập', [
        'BeefCare áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để hạn chế truy cập trái phép, mất mát, thay đổi hoặc tiết lộ dữ liệu. Quyền truy cập được kiểm tra theo tài khoản, vai trò và trang trại; mật khẩu, token và các thông tin xác thực nhạy cảm không được hiển thị công khai hoặc trả về trong các phản hồi thông thường.',
        'Không có hệ thống nào có thể bảo đảm an toàn tuyệt đối. Người dùng phải sử dụng mật khẩu mạnh, bảo vệ thiết bị, không chia sẻ phiên đăng nhập và thông báo sớm khi phát hiện dấu hiệu bất thường. Trong trường hợp có sự cố, BeefCare có thể tạm thời giới hạn chức năng, thu hồi phiên hoặc yêu cầu xác minh lại để giảm thiểu rủi ro.',
      ]),
      section('integrations', 'Dịch vụ và bên tích hợp', [
        'BeefCare có thể sử dụng dịch vụ của bên thứ ba cho hoạt động đăng nhập, gửi thư điện tử, thanh toán, đối soát hoặc hạ tầng kỹ thuật. Chỉ những dữ liệu cần thiết cho từng chức năng mới được chuyển đến dịch vụ tương ứng, và việc xử lý còn có thể chịu sự điều chỉnh của điều khoản riêng do bên thứ ba công bố.',
        'Việc người dùng lựa chọn sử dụng một phương thức tích hợp được hiểu là cho phép BeefCare trao đổi dữ liệu cần thiết để hoàn thành yêu cầu đó. BeefCare không chịu trách nhiệm đối với hoạt động độc lập của bên thứ ba nằm ngoài phạm vi kiểm soát hợp lý, nhưng sẽ thực hiện các biện pháp cần thiết khi phát hiện sự cố có liên quan.',
      ]),
      section('correction', 'Chỉnh sửa, lưu giữ và yêu cầu của người dùng', [
        'Người dùng có thể chỉnh sửa một số thông tin cá nhân trực tiếp trên giao diện hoặc liên hệ bộ phận hỗ trợ khi cần điều chỉnh dữ liệu không thể tự thay đổi. Đối với dữ liệu nghiệp vụ, việc sửa, hủy hoặc hiệu chỉnh phải tuân theo quy trình của từng chức năng và có thể yêu cầu lý do để bảo đảm tính minh bạch.',
        'Dữ liệu được lưu giữ trong thời gian cần thiết để cung cấp dịch vụ, bảo vệ quyền lợi hợp pháp, đáp ứng yêu cầu kiểm tra và giải quyết tranh chấp. Yêu cầu xóa tài khoản không nhất thiết dẫn đến việc xóa ngay mọi lịch sử nghiệp vụ nếu dữ liệu đó còn cần thiết cho tính toàn vẹn hồ sơ, nghĩa vụ pháp lý hoặc quyền lợi của trang trại và các bên liên quan.',
      ]),
    ],
  },
}
