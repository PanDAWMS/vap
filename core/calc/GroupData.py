from . import baseoperationclass
import numpy as np

GROUP_ARRAY = []


class GroupData(baseoperationclass.BaseOperationClass):

    _operation_name = 'Group Data'
    _operation_code_name = 'GroupData'
    _type_of_operation = 'grouping'

    def __init__(self, feature_name):
        super().__init__()
        self.feature_name = feature_name
        self.group_array = GROUP_ARRAY
        self.results = None

    def set_parameters(self, group_array):
        if group_array is not None:
            self.group_array = group_array
        return True

    def save_parameters(self):
        result = {'feature_name': self.feature_name, 'group_array': self.group_array}
        return result

    def load_parameters(self, parameters):
        if "feature_name" in parameters and parameters["feature_name"] is not None:
            self.feature_name = parameters["feature_name"]

        if "group_array" in parameters and parameters["group_array"] is not None:
            self.group_array = parameters["group_array"]
        else:
            self.group_array = GROUP_ARRAY
        return True

    def save_results(self):
        return {'results': self.results.tolist()}

    def load_results(self, results_dict):
        if 'results' in results_dict and results_dict['results'] is not None:
            self.results = np.array(results_dict['results'])
        return True

    def print_parameters(self):
        result = {'feature_name': self.feature_name, 'group_array': self.group_array}
        return result

    def process_data(self, dataset):
        grouped_dataset = dataset.groupby(self.feature_name)
        group_number = -1
        for name, group in grouped_dataset:
            group_number += 1
            for i in group.index.tolist():
                if dataset.index(i) >= 0:
                    self.results[dataset.index(i)] = group_number
        return self.results

try:
    baseoperationclass.register(GroupData)
except ValueError as error:
    print(repr(error))