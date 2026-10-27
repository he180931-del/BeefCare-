import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getPens } from 'app/entities/pen/pen.reducer';

import { createEntity, getEntity, reset, updateEntity } from './pen-reception-criteria.reducer';

export const PenReceptionCriteriaUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const pens = useAppSelector(state => state.pen.entities);
  const penReceptionCriteriaEntity = useAppSelector(state => state.penReceptionCriteria.entity);
  const loading = useAppSelector(state => state.penReceptionCriteria.loading);
  const updating = useAppSelector(state => state.penReceptionCriteria.updating);
  const updateSuccess = useAppSelector(state => state.penReceptionCriteria.updateSuccess);

  const handleClose = () => {
    navigate('/pen-reception-criteria');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getPens({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    if (values.versionNo !== undefined && typeof values.versionNo !== 'number') {
      values.versionNo = Number(values.versionNo);
    }

    const entity = {
      ...penReceptionCriteriaEntity,
      ...values,
      pen: pens.find(it => it.id.toString() === values.pen?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          ...penReceptionCriteriaEntity,
          pen: penReceptionCriteriaEntity?.pen?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.penReceptionCriteria.home.createOrEditLabel" data-cy="PenReceptionCriteriaCreateUpdateHeading">
            Thêm mới hoặc cập nhật Pen Reception Criteria
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && (
                <ValidatedField name="id" required readOnly id="pen-reception-criteria-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Version No"
                id="pen-reception-criteria-versionNo"
                name="versionNo"
                data-cy="versionNo"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  min: { value: 1, message: 'Trường này phải lớn hơn 1.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Accepted Purposes"
                id="pen-reception-criteria-acceptedPurposes"
                name="acceptedPurposes"
                data-cy="acceptedPurposes"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Accepted Stages"
                id="pen-reception-criteria-acceptedStages"
                name="acceptedStages"
                data-cy="acceptedStages"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Thresholds"
                id="pen-reception-criteria-thresholds"
                name="thresholds"
                data-cy="thresholds"
                type="text"
                validate={{
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Effective From"
                id="pen-reception-criteria-effectiveFrom"
                name="effectiveFrom"
                data-cy="effectiveFrom"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField id="pen-reception-criteria-pen" name="pen" data-cy="pen" label="Pen" type="select" required>
                <option value="" key="0" />
                {pens
                  ? pens.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button
                as={Link as any}
                id="cancel-save"
                data-cy="entityCreateCancelButton"
                to="/pen-reception-criteria"
                replace
                variant="info"
              >
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default PenReceptionCriteriaUpdate;
