package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Converter;
import vn.edu.fpt.beefcare.domain.enumeration.EstrusSign;

@Converter
public class EstrusSignSetConverter extends EnumSetConverter<EstrusSign> {

    public EstrusSignSetConverter() {
        super(EstrusSign.class);
    }
}
