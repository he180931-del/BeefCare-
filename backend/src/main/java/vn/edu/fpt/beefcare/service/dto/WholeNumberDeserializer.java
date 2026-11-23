package vn.edu.fpt.beefcare.service.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import java.io.IOException;

/**
 * Đọc một trường số nguyên từ JSON mà <b>không</b> tự làm tròn số thập phân.
 *
 * <p>Mặc định Jackson nhận {@code 1.5} cho trường {@code Integer} rồi cắt thành {@code 1} mà không báo gì.
 * Với các trường như số ngày ngưng thịt (FE-09, D45), giá trị phải là số nguyên đúng nghĩa: gửi {@code 1.5}
 * hoặc chuỗi {@code "5"} đều bị từ chối với lỗi đọc dữ liệu (HTTP 400), giống khi gửi chữ.
 */
public class WholeNumberDeserializer extends StdDeserializer<Integer> {

    public WholeNumberDeserializer() {
        super(Integer.class);
    }

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() == JsonToken.VALUE_NUMBER_INT) {
            return parser.getIntValue();
        }
        return (Integer) context.handleUnexpectedToken(Integer.class, parser);
    }
}
