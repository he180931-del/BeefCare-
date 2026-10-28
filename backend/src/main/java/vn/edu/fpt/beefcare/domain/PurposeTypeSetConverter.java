package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Converter;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;

@Converter
public class PurposeTypeSetConverter extends EnumSetConverter<PurposeType> {

    public PurposeTypeSetConverter() {
        super(PurposeType.class);
    }
}
