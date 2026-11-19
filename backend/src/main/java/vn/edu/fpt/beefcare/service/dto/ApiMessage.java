package vn.edu.fpt.beefcare.service.dto;

import java.util.Map;

/** A spec message code with its parameters, returned next to a successful result (toast / inline info). */
public record ApiMessage(String code, Map<String, Object> params) {}
