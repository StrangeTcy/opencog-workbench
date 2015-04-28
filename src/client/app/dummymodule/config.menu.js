(function() {
    'use strict';

    angular
        .module('app.dummymodule')
        .factory('dummymenus', dummymenus)
        .run(appRun);

    /* @ngInject */
    function dummymenus(dummymoduleConstants, _) {
        var moduleConstants = dummymoduleConstants;

        // set menu handler to noop, in case nobody is interested..
        var dummyClickHandler = angular.noop;
        var dummyChkValue = false;

        var menus = [
            {
                id: 'examplemenu',
                title: 'Example Items',
                items: [
                    // simple menu item with handler
                    {   
                        id: 'simpleitem',
                        type: 'simple',
                        content: 'Dummy',
                        handler: function() {
                            dummyClickHandler();
                        }
                    },
                    //  checkbox menu item
                    {
                        id: 'checkboxitem',
                        type: 'checkbox',
                        content: 'Dummy Check',
                        model: dummyChkValue
                    }
                ]
            }
        ];
        var service = {
            getModuleMenus: getModuleMenus,

            // set 'call dummy' handler
            onClickDummy: function(handler) {
                dummyClickHandler = handler;
            },
            getDummyChkValue: function () {
                var menu = _.find(menus, function(menu) { return menu.id === 'examplemenu'; });
                var item = _.find(menu.items, function(item) { return item.id === 'checkboxitem'; });
                return item.model;
            }
        };

        return service;
        ///////////////

        function getModuleMenus() {
            return menus;
        }
    }

    /* @ngInject */
    function appRun(menuhelper, dummymoduleConstants, dummymenus) {
        var moduleConstants = dummymoduleConstants;
        menuhelper.configureMenus(moduleConstants.name, dummymenus.getModuleMenus());
    }

})();