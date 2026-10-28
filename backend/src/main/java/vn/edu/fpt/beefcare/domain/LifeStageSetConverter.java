package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Converter;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;

@Converter
public class LifeStageSetConverter extends EnumSetConverter<LifeStage> {

    public LifeStageSetConverter() {
        super(LifeStage.class);
    }
}
