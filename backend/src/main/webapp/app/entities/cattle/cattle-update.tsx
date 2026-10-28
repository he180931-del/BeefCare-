import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getBreeds } from 'app/entities/breed/breed.reducer';
import { getEntities as getCattles } from 'app/entities/cattle/cattle.reducer';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { getEntities as getProductionPurposes } from 'app/entities/production-purpose/production-purpose.reducer';

import { createEntity, getEntity, reset, updateEntity } from './cattle.reducer';

export const CattleUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farms = useAppSelector(state => state.farm.entities);
  const breeds = useAppSelector(state => state.breed.entities);
  const productionPurposes = useAppSelector(state => state.productionPurpose.entities);
  const cattles = useAppSelector(state => state.cattle.entities);
  const cattleEntity = useAppSelector(state => state.cattle.entity);
  const loading = useAppSelector(state => state.cattle.loading);
  const updating = useAppSelector(state => state.cattle.updating);
  const updateSuccess = useAppSelector(state => state.cattle.updateSuccess);

  const handleClose = () => {
    navigate('/cattle');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarms({}));
    dispatch(getBreeds({}));
    dispatch(getProductionPurposes({}));
    dispatch(getCattles({}));
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
      ...cattleEntity,
      ...values,
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
      breed: breeds.find(it => it.id.toString() === values.breed?.toString()),
      purpose: productionPurposes.find(it => it.id.toString() === values.purpose?.toString()),
      dam: cattles.find(it => it.id.toString() === values.dam?.toString()),
      sire: cattles.find(it => it.id.toString() === values.sire?.toString()),
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
          ...cattleEntity,
          farm: cattleEntity?.farm?.id,
          breed: cattleEntity?.breed?.id,
          purpose: cattleEntity?.purpose?.id,
          dam: cattleEntity?.dam?.id,
          sire: cattleEntity?.sire?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.cattle.home.createOrEditLabel" data-cy="CattleCreateUpdateHeading">
            Thêm mới hoặc cập nhật Cattle
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="cattle-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Display Code"
                id="cattle-displayCode"
                name="displayCode"
                data-cy="displayCode"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField
                label="Ear Tag"
                id="cattle-earTag"
                name="earTag"
                data-cy="earTag"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <ValidatedField
                label="Sex"
                id="cattle-sex"
                name="sex"
                data-cy="sex"
                type="text"
                validate={{
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>MALE | FEMALE</Tooltip>}>
                <span id="sexLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField label="Birth Date" id="cattle-birthDate" name="birthDate" data-cy="birthDate" type="date" />
              <ValidatedField
                label="Life Stage"
                id="cattle-lifeStage"
                name="lifeStage"
                data-cy="lifeStage"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField
                label="Herd Status"
                id="cattle-herdStatus"
                name="herdStatus"
                data-cy="herdStatus"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ACTIVE | EXITED</Tooltip>}>
                <span id="herdStatusLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="cattle-farm" name="farm" data-cy="farm" label="Farm" type="select" required>
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="cattle-breed" name="breed" data-cy="breed" label="Breed" type="select" required>
                <option value="" key="0" />
                {breeds
                  ? breeds.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="cattle-purpose" name="purpose" data-cy="purpose" label="Purpose" type="select" required>
                <option value="" key="0" />
                {productionPurposes
                  ? productionPurposes.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="cattle-dam" name="dam" data-cy="dam" label="Dam" type="select">
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <ValidatedField id="cattle-sire" name="sire" data-cy="sire" label="Sire" type="select">
                <option value="" key="0" />
                {cattles
                  ? cattles.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/cattle" replace variant="info">
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

export default CattleUpdate;
