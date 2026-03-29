import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  BooleanInput,
  ArrayInput,
  SimpleFormIterator,
} from 'react-admin';

export function SubscriptionList() {
  return (
    <List sort={{ field: 'name', order: 'ASC' }}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="description" />
        <BooleanField source="active" />
        <TextField source="featureFlags" />
        <EditButton />
      </Datagrid>
    </List>
  );
}

function SubscriptionForm() {
  return (
    <>
      <TextInput source="name" fullWidth />
      <TextInput source="description" fullWidth multiline minRows={3} />
      <BooleanInput source="active" />
      <ArrayInput source="featureFlags">
        <SimpleFormIterator inline>
          <TextInput source="" label="Feature Flag" />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
}

export function SubscriptionCreate() {
  return (
    <Create>
      <SimpleForm>
        <SubscriptionForm />
      </SimpleForm>
    </Create>
  );
}

export function SubscriptionEdit() {
  return (
    <Edit>
      <SimpleForm>
        <SubscriptionForm />
      </SimpleForm>
    </Edit>
  );
}
