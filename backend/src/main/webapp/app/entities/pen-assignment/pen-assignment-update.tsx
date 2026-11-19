import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getPens } from 'app/entities/pen/pen.reducer';

import { createEntity, getEntity, reset, updateEntity } from './pen-assignment.reducer';

export const PenAssignmentUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const cattles = useAppSelector(state => state.cattle.entities);
  const pens = useAppSelector(state => state.pen.entities);
  const penAssignmentEntity = useAppSelector(state => state.penAssignment.entity);
  const loading = useAppSelector(state => state.penAssignment.loading);
  const updating = useAppSelector(state => state.penAssignment.updating);
  const updateSuccess = useAppSelector(state => state.penAssignment.updateSuccess);

  const handleClose = () => {
    navigate('/pen-assignment');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getCattles({}));
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

    const entity = {
      ...penAssignmentEntity,
      ...values,
      cattle: cattles.find(it => it.id.toString() === values.cattle?.toString()),
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
          ...penAssignmentEntity,
          cattle: penAssignmentEntity?.cattle?.id,
          pen: penAssignmentEntity?.pen?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.penAssignment.home.createOrEditLabel" data-cy="PenAssignmentCreateUpdateHeading">
            Thêm mới hoặc cập nhật Pen Assignment
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="pen-assignment-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Effective From"
                id="pen-assignment-effectiveFrom"
                name="effectiveFrom"
                data-cy="effectiveFrom"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Effective To" id="pen-assignment-effectiveTo" name="effectiveTo" data-cy="effectiveTo" type="date" />
              <ValidatedField
                label="Source"
                id="pen-assignment-source"
                name="source"
                data-cy="source"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>HERD_ENTRY | MOVE</Tooltip>}>
                <span id="sourceLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField label="Reason" id="pen-assignment-reason" name="reason" data-cy="reason" type="textarea" />
              <ValidatedField id="pen-assignment-cattle" name="cattle" data-cy="cattle" label="Cattle" type="select" required>
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="pen-assignment-pen" name="pen" data-cy="pen" label="Pen" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/pen-assignment" replace variant="info">
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

export default PenAssignmentUpdate;
